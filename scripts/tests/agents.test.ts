import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { agentOnlySkills, installableSkills, linkTargets } from '../../meta.ts'
import { cleanupUnusedEntries } from '../commands/cleanup.ts'
import { linkAll, unlinkAll } from '../commands/link.ts'
import { createAgentLinks, removeAgentLinks, renderAgents } from '../lib/agents.ts'
import { validateSkills } from '../lib/validation.ts'

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skills-agents-'))
  await mkdir(join(root, 'agents', 'reviewer'), { recursive: true })
  await mkdir(join(root, 'rules', 'engineering'), { recursive: true })
  await writeFile(join(root, 'rules', 'engineering', 'RULES.md'), '# Engineering Rules\n')
  await writeFile(join(root, 'agents', 'reviewer', 'AGENT.md'), '# Reviewer\n\nReview the assigned change.\n')
  await writeFile(join(root, 'agents', 'reviewer', 'agent.json'), JSON.stringify({
    name: 'reviewer',
    description: 'Reviews assigned changes.',
    rules: ['rules/engineering/RULES.md'],
    skills: ['dcr'],
  }))
  return root
}

test('renders native agent definitions from one source', async () => {
  const root = await fixture()
  try {
    assert.deepEqual(await renderAgents(root), ['reviewer'])
    const claude = await readFile(join(root, 'generated/agents/claude/reviewer.md'), 'utf8')
    const kimi = await readFile(join(root, 'generated/agents/kimi-code/reviewer.md'), 'utf8')
    const opencode = await readFile(join(root, 'generated/agents/opencode/reviewer.md'), 'utf8')
    const pi = await readFile(join(root, 'generated/agents/pi/reviewer.md'), 'utf8')

    for (const content of [claude, kimi, opencode, pi]) {
      assert.match(content, /name: reviewer/)
      assert.match(content, /Review the assigned change/)
      assert.match(content, /rules\/engineering\/RULES\.md/)
      assert.match(content, /- dcr/)
      assert.doesNotMatch(content, /On-demand skills/)
    }
    assert.match(claude, /skills:\n {2}- dcr/)
    assert.match(opencode, /mode: subagent/)
    assert.doesNotMatch(kimi, /mode: subagent/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an agent-only skill is rendered for its role but excluded from general skill targets', async () => {
  const root = await fixture()
  try {
    await writeFile(join(root, 'agents', 'reviewer', 'agent.json'), JSON.stringify({
      name: 'reviewer',
      description: 'Reviews assigned changes.',
      rules: [],
      skills: ['dcr'],
      agentOnlySkills: ['before-you-build'],
    }))
    await renderAgents(root)
    const claude = await readFile(join(root, 'generated/agents/claude/reviewer.md'), 'utf8')
    const kimi = await readFile(join(root, 'generated/agents/kimi-code/reviewer.md'), 'utf8')

    assert.ok(agentOnlySkills.includes('before-you-build'))
    for (const skill of agentOnlySkills) {
      assert.ok(!installableSkills.includes(skill))
      for (const target of linkTargets) {
        if (target.kind === 'skill')
          assert.ok(!target.include.includes(skill))
      }
    }
    assert.match(claude, /## Agent-only skills/)
    assert.match(claude, /generated\/before-you-build\/SKILL\.md/)
    assert.match(kimi, /generated\/before-you-build\/SKILL\.md/)
    assert.doesNotMatch(claude.split('---')[1], /before-you-build/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('links only owned agent files and removes them safely', async () => {
  const root = await fixture()
  const target = await mkdtemp(join(tmpdir(), 'skills-agent-target-'))
  try {
    await renderAgents(root)
    await writeFile(join(target, 'foreign.md'), '# Foreign\n')
    const results = await createAgentLinks({ format: 'claude', names: ['reviewer'], root, target })
    assert.deepEqual(results, [{ name: 'reviewer.md', target, status: 'linked' }])
    assert.equal(await readlink(join(target, 'reviewer.md')), join(root, 'generated/agents/claude/reviewer.md'))
    assert.deepEqual(await removeAgentLinks({ format: 'claude', root, target }), [
      { name: 'reviewer.md', target, status: 'removed' },
    ])
    assert.equal(await readFile(join(target, 'foreign.md'), 'utf8'), '# Foreign\n')
  }
  finally {
    await rm(root, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
  }
})

test('the link command installs and uninstalls an agent target', async () => {
  const root = await fixture()
  const configDir = await mkdtemp(join(tmpdir(), 'skills-agent-config-'))
  const target = join(configDir, 'agents')
  const targets = [{ dir: target, format: 'opencode', kind: 'agent' }] as const
  try {
    const linked = await linkAll({ root, localSkillSources: [], targets })
    assert.deepEqual(linked, [{ name: 'reviewer.md', target, status: 'linked' }])
    assert.equal(await readlink(join(target, 'reviewer.md')), join(root, 'generated/agents/opencode/reviewer.md'))
    assert.deepEqual(await unlinkAll({ root, targets }), [
      { name: 'reviewer.md', target, status: 'removed' },
    ])
  }
  finally {
    await rm(root, { recursive: true, force: true })
    await rm(configDir, { recursive: true, force: true })
  }
})

test('rejects unknown skills in a role', async () => {
  const root = await fixture()
  try {
    await writeFile(join(root, 'agents', 'reviewer', 'agent.json'), JSON.stringify({
      name: 'reviewer',
      description: 'Reviews assigned changes.',
      rules: [],
      skills: ['missing-skill'],
    }))
    await assert.rejects(() => renderAgents(root), /Unknown skill missing-skill/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('validation reports stale generated role files', async () => {
  const root = await fixture()
  try {
    await renderAgents(root)
    await writeFile(join(root, 'generated/agents/pi/reviewer.md'), '# Stale\n')
    const result = await validateSkills({ root, agentOnlySkills: [], installableSkills: [], localSkillSources: [] })
    assert.deepEqual(result.issues.map(issue => issue.code), ['stale-generated-agent'])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('skill cleanup preserves generated agents and their installed links', async () => {
  const root = await fixture()
  const target = join(root, 'tool-agents')
  try {
    await renderAgents(root)
    await createAgentLinks({ format: 'claude', names: ['reviewer'], root, target })
    const roleContent = await readFile(join(target, 'reviewer.md'), 'utf8')
    await mkdir(join(root, 'generated', 'retired-skill'))
    const options = { root, installableSkills: [], localSkillSources: [], vendors: {} }

    const preview = await cleanupUnusedEntries(options)
    assert.deepEqual(preview.skills, [{ name: 'retired-skill', status: 'would-remove' }])
    const result = await cleanupUnusedEntries({ ...options, yes: true })
    assert.deepEqual(result.skills, [{ name: 'retired-skill', status: 'removed' }])
    assert.equal(await readFile(join(target, 'reviewer.md'), 'utf8'), roleContent)
    const validation = await validateSkills({ root, agentOnlySkills: [], installableSkills: [], localSkillSources: [] })
    assert.deepEqual(validation.issues, [])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const change of ['rename', 'delete-all'] as const) {
  test(`validation detects retired generated agents after ${change}, and linking removes them`, async () => {
    const root = await fixture()
    const target = join(root, 'tool-agents')
    const targets = [{ dir: target, format: 'claude', kind: 'agent' }] as const
    const validationOptions = { root, agentOnlySkills: [], installableSkills: [], localSkillSources: [] }
    try {
      await linkAll({ root, localSkillSources: [], targets })
      if (change === 'rename') {
        await rename(join(root, 'agents', 'reviewer'), join(root, 'agents', 'auditor'))
        const manifestPath = join(root, 'agents', 'auditor', 'agent.json')
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        await writeFile(manifestPath, JSON.stringify({ ...manifest, name: 'auditor' }))
      }
      else {
        await rm(join(root, 'agents'), { recursive: true })
      }

      const before = await validateSkills(validationOptions)
      assert.equal(before.ok, false)
      assert.deepEqual(before.issues.filter(issue => issue.code === 'unexpected-generated-agent').map(issue => issue.path).sort(), [
        'generated/agents/claude/reviewer.md',
        'generated/agents/kimi-code/reviewer.md',
        'generated/agents/opencode/reviewer.md',
        'generated/agents/pi/reviewer.md',
      ])
      if (change === 'rename')
        assert.equal(before.issues.filter(issue => issue.code === 'missing-generated-agent').length, 4)

      await linkAll({ root, localSkillSources: [], targets })
      assert.deepEqual((await validateSkills(validationOptions)).issues, [])
      await assert.rejects(readlink(join(target, 'reviewer.md')), { code: 'ENOENT' })
      if (change === 'rename')
        assert.match(await readFile(join(target, 'auditor.md'), 'utf8'), /name: auditor/)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}
