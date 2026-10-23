import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { stringify } from 'yaml'

import { type IntegrationKind, validateBinding } from '../lib/integrationContracts.ts'
import { importProjectBinding, resolveProjectBinding, saveProjectBinding } from '../lib/projectBindings.ts'
import { listWorkspaces, saveWorkspace } from '../lib/projectWorkspaces.ts'

const exec = promisify(execFile)
const serverA = 'https://a.example.test/zentao'
const serverB = 'https://b.example.test/zentao'
const bindings = {
  zentao: { schemaVersion: 2, server: serverA, product: null, project: { id: 7, name: 'Supply chain' } },
  psql: { schemaVersion: 1, defaultService: 'orders', services: [{ name: 'orders', dbname: 'orders', environment: 'dev', metadata: { label: 'primary' } }] },
  apifox: { schemaVersion: 1, defaultProject: 'backend', projects: [{ key: 'backend', id: 7, name: 'API', server: serverA, credential: 'work' }] },
}

async function setup(t: { after: (callback: () => Promise<void>) => void }) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'project-bindings-')))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const root = join(directory, 'skills')
  const web = join(directory, 'web')
  const api = join(directory, 'api')
  await mkdir(web)
  await mkdir(api)
  const map = { name: 'scm', projects: { web: { path: web, uses: ['api'] }, api: { path: api } } }
  const options = { root }
  const saved = await saveWorkspace(map, options)
  const legacy = async (kind: IntegrationKind, value: unknown = bindings[kind], project = api) => {
    if (kind === 'apifox') await mkdir(join(project, '.apifox'), { recursive: true })
    const file = join(project, kind === 'apifox' ? '.apifox/projects.json' : kind === 'psql' ? '.psql' : '.zentao')
    await writeFile(file, JSON.stringify(value, null, 2) + '\n')
    return file
  }
  return { directory, root, web, api, map, options, file: saved.file, legacy }
}

test('registered unmigrated members retain each legacy binding; unbound ones return none', async t => {
  const c = await setup(t)
  for (const kind of ['zentao', 'psql', 'apifox'] as const) {
    const file = await c.legacy(kind)
    const result = await resolveProjectBinding(c.api, kind, c.options)
    assert.equal(result.source, 'repository')
    assert.equal(result.file, file)
    assert.deepEqual(result.binding, bindings[kind])
    assert.equal((await resolveProjectBinding(c.web, kind, c.options)).source, 'none')
  }
})

test('workspace references own bindings despite conflicting or malformed legacy files', async t => {
  const c = await setup(t)
  for (const kind of ['zentao', 'psql', 'apifox'] as const) {
    const file = await c.legacy(kind)
    await saveProjectBinding(c.api, kind, 'main', bindings[kind], c.options)
    await writeFile(file, 'broken legacy JSON; do not use this')
    const resolved = await resolveProjectBinding(c.api, kind, c.options)
    assert.equal(resolved.source, 'workspace')
    assert.equal(resolved.workspace, 'scm')
    assert.equal(resolved.member, 'api')
    assert.equal(resolved.resource, 'main')
    assert.deepEqual(resolved.binding, bindings[kind])
  }
  assert.equal((await resolveProjectBinding(c.web, 'psql', c.options)).source, 'none', 'uses does not inherit database access')
})

test('shared resources work from either member and updates preserve other integrations and members', async t => {
  const c = await setup(t)
  await saveProjectBinding(c.api, 'zentao', 'main', bindings.zentao, c.options)
  const linked = await saveProjectBinding(c.web, 'zentao', 'main', bindings.zentao, c.options)
  assert.deepEqual(linked.affectedMembers.sort(), ['api', 'web'])
  await saveProjectBinding(c.api, 'psql', 'backend', bindings.psql, c.options)
  for (const project of [c.web, c.api])
    assert.deepEqual((await resolveProjectBinding(project, 'zentao', c.options)).binding, bindings.zentao)
  const saved = (await listWorkspaces(c.root)).workspaces[0].workspace
  assert.deepEqual(saved.projects.web.uses, ['api'])
  assert.equal(Object.keys(saved.resources!.zentao!).length, 1)
  assert.equal(saved.projects.api.bindings?.psql, 'backend')
  assert.equal(saved.projects.web.bindings?.psql, undefined)
})

test('explicit migration preserves original bytes and refuses different existing resources', async t => {
  const c = await setup(t)
  for (const kind of ['zentao', 'psql', 'apifox'] as const) {
    const file = await c.legacy(kind)
    const original = await readFile(file, 'utf8')
    const imported = await importProjectBinding(c.api, kind, 'main', c.options)
    assert.equal(imported.legacyFileRetained, true)
    assert.equal(imported.importedFrom, file)
    assert.equal(await readFile(file, 'utf8'), original)
    assert.equal((await resolveProjectBinding(c.api, kind, c.options)).source, 'workspace')
  }
  await c.legacy('zentao', { ...bindings.zentao, server: serverB })
  await assert.rejects(importProjectBinding(c.api, 'zentao', 'main', c.options), /overwrite/)
  await assert.rejects(importProjectBinding(c.api, 'zentao', 'another', c.options), /another resource/)
})

test('multiple workspace providers require a selector and unknown names never fall back', async t => {
  const c = await setup(t)
  await saveWorkspace({ ...c.map, name: 'other' }, c.options)
  await saveProjectBinding(c.api, 'zentao', 'main', bindings.zentao, { ...c.options, workspace: 'scm' })
  await saveProjectBinding(c.api, 'zentao', 'main', { ...bindings.zentao, server: serverB }, { ...c.options, workspace: 'other' })
  await assert.rejects(resolveProjectBinding(c.api, 'zentao', c.options), /Multiple workspace/)
  const other = await resolveProjectBinding(c.api, 'zentao', { ...c.options, workspace: 'other' })
  assert.equal(other.binding?.server, serverB)
  await assert.rejects(resolveProjectBinding(c.api, 'zentao', { ...c.options, workspace: 'unknown' }), /no fallback/)
  await assert.rejects(saveProjectBinding(c.api, 'psql', 'main', bindings.psql, c.options), /--workspace/)
})

test('invalid workspace references or maps fail before any legacy fallback', async t => {
  const c = await setup(t)
  await c.legacy('zentao')
  await writeFile(c.file, stringify({ ...c.map, projects: { ...c.map.projects, api: { path: c.api, bindings: { zentao: 'missing' } } } }))
  await assert.rejects(resolveProjectBinding(c.api, 'zentao', c.options), /Workspace discovery failed/)
  await writeFile(c.file, 'bad: [invalid\n')
  await assert.rejects(resolveProjectBinding(c.api, 'zentao', c.options), /Workspace discovery failed/)
})

test('concurrent integration updates never both succeed while losing another resource', async t => {
  const c = await setup(t)
  const operations = [
    () => saveProjectBinding(c.api, 'zentao', 'main', bindings.zentao, c.options),
    () => saveProjectBinding(c.api, 'psql', 'backend', bindings.psql, c.options),
  ]
  const results = await Promise.allSettled(operations.map(operation => operation()))
  assert.ok(results.some(result => result.status === 'fulfilled'))
  for (let index = 0; index < results.length; index += 1) {
    if (results[index].status === 'rejected')
      await operations[index]()
  }
  assert.deepEqual((await resolveProjectBinding(c.api, 'zentao', c.options)).binding, bindings.zentao)
  assert.deepEqual((await resolveProjectBinding(c.api, 'psql', c.options)).binding, bindings.psql)
})

test('integration schemas reject credentials, unsupported versions, invalid defaults and symlink legacy files', async t => {
  const c = await setup(t)
  for (const [kind, value] of [
    ['zentao', { ...bindings.zentao, account: 'private' }],
    ['zentao', { ...bindings.zentao, schemaVersion: 1 }],
    ['apifox', { ...bindings.apifox, token: 'private' }],
    ['apifox', { ...bindings.apifox, defaultProject: 'missing' }],
    ['psql', { ...bindings.psql, defaultService: 'missing' }],
    ['psql', { ...bindings.psql, services: [{ name: 'dev', dbname: 'orders', metadata: { host: 'hidden' } }] }],
    ['psql', { ...bindings.psql, services: [{ name: 'dev', dbname: 'postgresql://hidden/db' }] }],
  ] as const) {
    assert.throws(() => validateBinding(kind, value))
  }
  const file = await c.legacy('psql')
  await rm(file)
  await symlink(c.file, file)
  await assert.rejects(resolveProjectBinding(c.api, 'psql', c.options), /regular file/)
})

async function helperFixture(directory: string, kind: 'apifox' | 'zentao') {
  const bin = join(directory, 'bin')
  await mkdir(bin, { recursive: true })
  await copyFile(fileURLToPath(new URL(`./fixtures/${kind}-cli.mjs`, import.meta.url)), join(bin, kind))
  await chmod(join(bin, kind), 0o700)
  const helper = new URL(`../../skills/${kind}-init/scripts/connection.mjs`, import.meta.url).href
  const invocation = kind === 'apifox'
    ? 'await module.main(JSON.parse(process.argv[2]), {workspaceRoot: process.argv[3]})'
    : 'console.log(JSON.stringify(await module.run(JSON.parse(process.argv[2]), {workspaceRoot: process.argv[3]})))'
  return async (args: string[], root: string) => exec(process.execPath,
    ['--input-type=module', '-e', `const module = await import(process.argv[1]); ${invocation}`, helper, JSON.stringify(args), root],
    { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_APIFOX_LOG: join(directory, 'apifox-calls.jsonl'), FAKE_ZENTAO_LOG: join(directory, 'zentao-calls.jsonl') }, timeout: 15_000 })
}

test('Apifox helper executes the workspace server/token instead of conflicting legacy bindings', async t => {
  const c = await setup(t)
  await c.legacy('apifox', { ...bindings.apifox, projects: [{ ...bindings.apifox.projects[0], server: serverB }] })
  await saveProjectBinding(c.api, 'apifox', 'main', bindings.apifox, c.options)
  const credentials = join(c.directory, 'credentials.json')
  await writeFile(credentials, JSON.stringify({ schemaVersion: 1, credentials: { work: { server: serverA, token: 'secret-A-for-tests' } } }), { mode: 0o600 })
  const invoke = await helperFixture(c.directory, 'apifox')
  const result = await invoke(['run', '--root', c.api, '--credentials', credentials, '--', 'endpoint', 'list'], c.root)
  assert.equal(JSON.parse(result.stdout).server, serverA)
  assert.equal(JSON.parse(result.stdout).credential, 'a')
  const inspected = await invoke(['inspect', '--root', c.api, '--credentials', credentials], c.root)
  assert.equal(JSON.parse(inspected.stdout).source.source, 'workspace')
})

test('ZenTao helper inspects bindings without credentials and rejects conflicting servers before remote reads', async t => {
  const c = await setup(t)
  await c.legacy('zentao', { ...bindings.zentao, server: serverB })
  await saveProjectBinding(c.api, 'zentao', 'main', bindings.zentao, c.options)
  const invoke = await helperFixture(c.directory, 'zentao')
  const inspected = await invoke(['inspect', '--root', c.api], c.root)
  assert.equal(JSON.parse(inspected.stdout).source, 'workspace')
  const config = join(c.directory, 'zentao.json')
  const profile = `alice@${serverA}`
  const original = JSON.stringify({ currentProfile: profile, profiles: [{ key: profile, server: serverA, account: 'alice', token: 'imaginary-secret-token' }] })
  await writeFile(config, original)
  const read = ['run', '--root', c.api, '--config', config, '--profile', profile]
  const result = await invoke([...read, '--', 'bug', '7'], c.root)
  assert.equal(JSON.parse(result.stdout).server, serverA)
  await assert.rejects(invoke([...read, '--server', serverB, '--', 'bug', '7'], c.root), /conflicts with the effective binding/)
  assert.equal(await readFile(config, 'utf8'), original)
})
