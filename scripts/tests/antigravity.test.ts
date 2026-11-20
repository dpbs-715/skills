import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'

import { linkTargets } from '../../meta.template.ts'
import { linkAll, unlinkAll } from '../commands/link.ts'
import type { LinkTarget } from '../lib/metaTypes.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

const antigravityTargets = linkTargets.filter(target => 'file' in target
  ? target.file === '~/.gemini/GEMINI.md'
  : target.dir.startsWith('~/.gemini/config/'))
const temporaryPaths: string[] = []

function underHome(targets: readonly LinkTarget[], home: string): LinkTarget[] {
  return targets.map(target => 'file' in target
    ? { ...target, file: join(home, target.file.slice(2)) }
    : { ...target, dir: join(home, target.dir.slice(2)) })
}

async function fixture() {
  const temporary = await mkdtemp(join(tmpdir(), 'antigravity hosts-'))
  temporaryPaths.push(temporary)
  const root = join(temporary, 'repo')
  const home = join(temporary, 'home')
  await mkdir(home)
  for (const target of antigravityTargets) {
    if (target.kind === 'markdown-section') {
      await mkdir(dirname(join(root, target.source)), { recursive: true })
      await writeFile(join(root, target.source), await readFile(join(repoRoot(), target.source)))
    }
    if (target.kind === 'skill') {
      for (const name of target.include) {
        const source = join(root, 'generated', name)
        await mkdir(source, { recursive: true })
        await writeFile(join(source, 'SKILL.md'), `---\nname: ${name}\ndescription: Test skill.\n---\n`)
      }
    }
  }
  const roleSkill = join(root, 'generated', 'before-you-build')
  await mkdir(roleSkill, { recursive: true })
  await writeFile(join(roleSkill, 'SKILL.md'), '---\nname: before-you-build\ndescription: Role-only test skill.\n---\n')
  await mkdir(join(root, 'agents', 'reviewer'), { recursive: true })
  await writeFile(join(root, 'agents', 'reviewer', 'AGENT.md'), '# Reviewer\n\nReview the assigned change.\n')
  await writeFile(join(root, 'agents', 'reviewer', 'agent.json'), JSON.stringify({
    name: 'reviewer', description: 'Reviews assigned changes.', rules: [], skills: ['dcr'],
    agentOnlySkills: ['before-you-build'],
  }))
  return { root, home }
}

test('the template configures Antigravity without Gemini CLI-specific targets', () => {
  const sections = antigravityTargets.filter(target => target.kind === 'markdown-section')
  assert.deepEqual(sections.map(target => target.section), [
    'communication-rules', 'agent-routing', 'project-workspaces', 'skill-feedback',
  ])
  const skills = antigravityTargets.find(target => target.kind === 'skill')
  assert.ok(skills && skills.kind === 'skill')
  assert.equal(skills.dir, '~/.gemini/config/skills')
  assert.equal(skills.createIfParentExists, true)
  for (const name of ['communication-rules', 'agent-routing', 'project-workspaces', 'skill-feedback', 'before-you-build'])
    assert.ok(!skills.include.includes(name))
  for (const name of ['engineering-rules', 'problem-solving-rules', 'dcr'])
    assert.ok(skills.include.includes(name))
  assert.deepEqual(antigravityTargets.filter(target => target.kind === 'agent'), [
    { dir: '~/.gemini/config/agents', format: 'antigravity', kind: 'agent' },
  ])
  assert.ok(!antigravityTargets.some(target => target.kind === 'json-array' || target.kind === 'json-object' || target.kind === 'rule'))
  assert.ok(!linkTargets.some(target => 'dir' in target && ['~/.gemini/skills', '~/.gemini/agents'].includes(target.dir)))
})

test('Antigravity links, relinks and unlinks without changing personal rules, settings or foreign files', async () => {
  const { root, home } = await fixture()
  const config = join(home, '.gemini', 'config')
  await mkdir(config, { recursive: true })
  const global = join(home, '.gemini', 'GEMINI.md')
  const original = '# Personal instructions\nUse Chinese.\n'
  await writeFile(global, original)
  const settings = join(home, '.gemini', 'settings.json')
  const mcp = join(config, 'mcp_config.json')
  const privateConfiguration = '{"mcpServers":{"private":{"token":"test-secret"}}}\n'
  await writeFile(settings, privateConfiguration)
  await writeFile(mcp, privateConfiguration)
  const targets = underHome(antigravityTargets, home)
  const options = { root, localSkillSources: [], targets }

  await linkAll(options)
  const installed = await readFile(global, 'utf8')
  assert.ok(installed.startsWith(original))
  assert.doesNotMatch(installed, /\{\{REPO_ROOT\}\}/)
  for (const section of ['communication-rules', 'agent-routing', 'project-workspaces', 'skill-feedback'])
    assert.equal(installed.split(`<!-- skills-managed:${section}:start -->`).length, 2)

  for (const target of targets) {
    if (target.kind === 'skill') {
      assert.equal(await readlink(join(target.dir, 'dcr')), join(root, 'generated', 'dcr'))
      assert.equal(await pathExists(join(target.dir, 'agent-routing')), false)
      assert.equal(await pathExists(join(target.dir, 'before-you-build')), false)
      await symlink('/tmp/foreign-antigravity-skill', join(target.dir, 'foreign'))
    }
    if (target.kind === 'agent') {
      const file = join(target.dir, 'reviewer.md')
      assert.equal(await readlink(file), join(root, 'generated', 'agents', 'antigravity', 'reviewer.md'))
      const content = await readFile(file, 'utf8')
      assert.deepEqual(parse(content.split('---')[1]), {
        name: 'reviewer', description: 'Reviews assigned changes.', subagent: true, mainAgent: false,
      })
      assert.ok(content.includes(`[dcr](<${root}/generated/dcr/SKILL.md>)`))
      assert.ok(content.includes(`[before-you-build](<${root}/generated/before-you-build/SKILL.md>)`))
      assert.match(await readFile(join(root, 'generated', 'before-you-build', 'SKILL.md'), 'utf8'), /Role-only test skill/)
      await writeFile(join(target.dir, 'foreign.md'), '# Foreign agent\n')
    }
  }
  assert.ok((await linkAll(options)).every(result => result.status === 'exists'))
  assert.equal(await readFile(global, 'utf8'), installed)
  assert.equal(await readFile(settings, 'utf8'), privateConfiguration)
  assert.equal(await readFile(mcp, 'utf8'), privateConfiguration)

  await unlinkAll(options)
  assert.equal(await readFile(global, 'utf8'), original)
  for (const target of targets) {
    if (target.kind === 'skill') {
      await assert.rejects(readlink(join(target.dir, 'dcr')), { code: 'ENOENT' })
      assert.equal(await readlink(join(target.dir, 'foreign')), '/tmp/foreign-antigravity-skill')
    }
    if (target.kind === 'agent') {
      await assert.rejects(readlink(join(target.dir, 'reviewer.md')), { code: 'ENOENT' })
      assert.equal(await readFile(join(target.dir, 'foreign.md'), 'utf8'), '# Foreign agent\n')
    }
  }
  assert.equal(await readFile(settings, 'utf8'), privateConfiguration)
  assert.equal(await readFile(mcp, 'utf8'), privateConfiguration)
})

test('Antigravity installation leaves Gemini CLI-specific directories absent', async () => {
  const { root, home } = await fixture()
  await mkdir(join(home, '.gemini', 'config'), { recursive: true })
  await linkAll({ root, localSkillSources: [], targets: underHome(antigravityTargets, home) })
  assert.equal(await pathExists(join(home, '.gemini', 'GEMINI.md')), true)
  assert.equal(await pathExists(join(home, '.gemini', 'config', 'skills', 'dcr')), true)
  assert.equal(await pathExists(join(home, '.gemini', 'config', 'agents', 'reviewer.md')), true)
  assert.equal(await pathExists(join(home, '.gemini', 'skills')), false)
  assert.equal(await pathExists(join(home, '.gemini', 'agents')), false)
})

test('an absent Antigravity customization parent is not initialized', async () => {
  const { root, home } = await fixture()
  await mkdir(join(home, '.gemini'))
  await linkAll({ root, localSkillSources: [], targets: underHome(antigravityTargets, home) })
  assert.equal(await pathExists(join(home, '.gemini', 'config')), false)
  assert.equal(await pathExists(join(home, '.gemini', 'skills')), false)
  assert.equal(await pathExists(join(home, '.gemini', 'agents')), false)
})

test('Antigravity targets do not create configuration for absent hosts', async () => {
  const { root, home } = await fixture()
  const results = await linkAll({ root, localSkillSources: [], targets: underHome(antigravityTargets, home) })
  assert.deepEqual(results, [])
  assert.equal(await pathExists(join(home, '.gemini')), false)
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
