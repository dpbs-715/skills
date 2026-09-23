import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { agentOnlySkills, installableSkills, linkTargets } from '../../meta.ts'
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
