import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import process from 'node:process'

import {
  discoverWorkspaces, inspectProject, listWorkspaces, parseWorkspace,
  projectIdentity, saveWorkspace, workspaceDirectory,
} from '../lib/projectWorkspaces.ts'

const execFileAsync = promisify(execFile)
const temporaryPaths: string[] = []

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'project-workspaces-')))
  temporaryPaths.push(root)
  const web = join(root, 'web')
  const api = join(root, 'services', 'api')
  await mkdir(join(web, 'src'), { recursive: true })
  await mkdir(api, { recursive: true })
  return {
    root, web, api,
    map: { name: 'scm', projects: { web: { path: web, uses: ['api'] }, api: { path: api } } },
  }
}

test('discovery is read-only for an unregistered repository and an absent map store', async () => {
  const { root, web } = await fixture()
  assert.deepEqual(await listWorkspaces(root), { workspaces: [], issues: [] })
  const result = await discoverWorkspaces(web, root)
  assert.deepEqual(result.workspaces, [])
  assert.deepEqual(result.issues, [])
  await assert.rejects(readdir(workspaceDirectory(root)), /ENOENT/)
})

test('one private YAML map is discovered from either member, subdirectories and symlinks', async () => {
  const { root, web, api, map } = await fixture()
  const saved = await saveWorkspace(map, { root })
  assert.equal(saved.file, join(workspaceDirectory(root), 'scm.yaml'))
  assert.match(await readFile(saved.file, 'utf8'), /name: scm/)
  const alias = join(root, 'web-link')
  await symlink(web, alias)
  for (const cwd of [web, api, join(web, 'src'), alias]) {
    const result = await discoverWorkspaces(cwd, root)
    assert.equal(result.workspaces.length, 1)
    assert.equal(result.workspaces[0].name, 'scm')
    assert.equal(result.workspaces[0].projects.filter(project => project.current).length, 1)
  }
  assert.equal((await listWorkspaces(root)).workspaces.length, 1)
})

test('new maps cannot overwrite existing maps and updates require a valid existing identity', async () => {
  const { root, map } = await fixture()
  const saved = await saveWorkspace(map, { root })
  const original = await readFile(saved.file, 'utf8')
  await assert.rejects(saveWorkspace({ ...map, description: 'changed' }, { root }), /EEXIST/)
  assert.equal(await readFile(saved.file, 'utf8'), original)
  const updated = await saveWorkspace({ ...map, description: 'changed' }, { root, replace: true })
  assert.equal(updated.workspace.description, 'changed')
  await writeFile(saved.file, 'name: [broken\n')
  await assert.rejects(saveWorkspace(map, { root, replace: true }))
  assert.equal(await readFile(saved.file, 'utf8'), 'name: [broken\n')
  await assert.rejects(saveWorkspace({ ...map, name: 'another' }, { root, replace: true }), /ENOENT/)
})

test('missing members stay in discovery and can be preserved unchanged during updates', async () => {
  const { root, web, api, map } = await fixture()
  const saved = await saveWorkspace(map, { root })
  await rm(api, { recursive: true })
  const discovered = await discoverWorkspaces(web, root)
  assert.equal(discovered.workspaces[0].projects.find(project => project.key === 'api')?.available, false)
  await saveWorkspace({ ...saved.workspace, description: 'retained missing backend' }, { root, replace: true })
  assert.equal((await listWorkspaces(root)).workspaces[0].workspace.projects.api.path, api)
  await assert.rejects(saveWorkspace({
    ...map, projects: { ...map.projects, mobile: { path: join(root, 'missing-mobile') } },
  }, { root, replace: true }), /ENOENT/)
})

test('malformed maps are reported without hiding valid matches or being rewritten', async () => {
  const { root, web, map } = await fixture()
  await saveWorkspace(map, { root })
  const broken = join(workspaceDirectory(root), 'broken.yaml')
  await writeFile(broken, 'name: [oops\n')
  const result = await discoverWorkspaces(web, root)
  assert.equal(result.workspaces.length, 1)
  assert.equal(result.issues.length, 1)
  assert.equal(result.issues[0].file, broken)
  assert.equal(await readFile(broken, 'utf8'), 'name: [oops\n')
})

test('validation rejects ambiguous fields, bad dependencies, duplicate YAML keys and path traversal', async () => {
  const { root, map } = await fixture()
  for (const invalid of [
    { ...map, name: '../escape' },
    { ...map, projects: {} },
    { ...map, tools: { serena: 'connected' } },
    { ...map, projects: { web: { path: 'relative' } } },
    { ...map, projects: { web: { path: root, uses: ['missing'] } } },
    { ...map, projects: { web: { path: root, uses: ['web'] } } },
    { ...map, projects: { web: { path: root, uses: [123] } } },
  ]) {
    await assert.rejects(saveWorkspace(invalid, { root }))
  }
  assert.throws(() => parseWorkspace('name: scm\nname: other\nprojects: {}\n'), /unique/)
  await assert.rejects(readdir(workspaceDirectory(root)), /ENOENT/)
})

test('inspection lists live resource paths without reading configuration or claiming tool connectivity', async () => {
  const { web } = await fixture()
  await writeFile(join(web, 'AGENTS.md'), '# frontend rules\n')
  await writeFile(join(web, '.mcp.json'), '{"token":"do-not-print-secret"}')
  await mkdir(join(web, '.serena'))
  await writeFile(join(web, '.serena', 'project.yml'), 'name: web\n')
  await mkdir(join(web, '.pi', 'agents'), { recursive: true })
  const result = await inspectProject(web)
  assert.deepEqual(result.resources.instructions, [join(web, 'AGENTS.md')])
  assert.deepEqual(result.resources.mcp, [join(web, '.mcp.json')])
  assert.deepEqual(result.resources.agents, [join(web, '.pi', 'agents')])
  assert.deepEqual(result.resources.serena, [join(web, '.serena', 'project.yml')])
  assert.equal(result.toolStatus, 'configuration-discovered-only')
  assert.doesNotMatch(JSON.stringify(result), /do-not-print-secret/)
  await rm(join(web, '.mcp.json'))
  assert.deepEqual((await inspectProject(web)).resources.mcp, [])
})

test('all matching workspaces are returned and separate clones never match by name', async () => {
  const { root, web, map } = await fixture()
  await saveWorkspace(map, { root })
  await saveWorkspace({ ...map, name: 'another-system' }, { root })
  assert.equal((await discoverWorkspaces(web, root)).workspaces.length, 2)
  const unrelated = join(root, 'clone', 'web')
  await mkdir(unrelated, { recursive: true })
  assert.equal((await discoverWorkspaces(unrelated, root)).workspaces.length, 0)
})

test('Git worktrees match the registered repository while retaining their active checkout', async () => {
  const { root, web, map } = await fixture()
  await execFileAsync('git', ['init', web])
  await execFileAsync('git', ['-C', web, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'initial'])
  const worktree = join(root, 'web-feature')
  await execFileAsync('git', ['-C', web, 'worktree', 'add', '-b', 'feature', worktree])
  await saveWorkspace(map, { root })
  const result = await discoverWorkspaces(worktree, root)
  const current = result.workspaces[0].projects.find(project => project.current)
  assert.equal(current?.path, worktree)
  assert.ok(current && 'registeredPath' in current)
  assert.equal(current.registeredPath, web)
  await assert.rejects(saveWorkspace({
    name: 'duplicate', projects: { web: { path: web }, feature: { path: worktree } },
  }, { root }), /duplicates/)
  const nested = join(web, 'src')
  assert.equal((await projectIdentity(nested)).root, web)
})

test('Git access errors are not treated as an unregistered non-Git directory', async () => {
  const { root, web } = await fixture()
  const bin = join(root, 'bin')
  await mkdir(bin)
  await writeFile(join(bin, 'git'), '#!/bin/sh\nexit 42\n', { mode: 0o700 })
  const module = new URL('../lib/projectWorkspaces.ts', import.meta.url).href
  await assert.rejects(execFileAsync(process.execPath, [
    '--input-type=module', '-e', 'const m = await import(process.argv[1]); await m.projectIdentity(process.argv[2]);', module, web,
  ], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }), /Git identity lookup failed/)
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
