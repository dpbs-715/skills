import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { linkTargets } from '../../meta.ts'
import { linkAll, runUnlink, unlinkAll } from '../commands/link.ts'
import { ensureJsonArrayEntries, ensureJsonObjectEntries } from '../lib/jsonConfig.ts'
import { createRuleLinks, removeRuleLinks } from '../lib/ruleLinks.ts'
import type { LocalSkillSource } from '../lib/metaTypes.ts'
import {
  createSkillLinks,
  discoverSkills,
  removeSkillLinks,
  renderLocalSkillSources,
  REPO_ROOT_TOKEN,
} from '../lib/skillLinks.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

const temporaryPaths: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

async function createGeneratedSkill(root: string, name: string): Promise<string> {
  const skillDir = join(root, 'generated', name)
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: Use when testing.\n---\n`)
  return skillDir
}

async function createSourceSkill(root: string, name: string): Promise<void> {
  const sourceDir = join(root, 'skills', name)
  await mkdir(sourceDir, { recursive: true })
  await writeFile(
    join(sourceDir, 'SKILL.md'),
    `Read \`${REPO_ROOT_TOKEN}/rules/engineering/RULES.md\`.\n`,
  )
}

function directorySource(name: string): LocalSkillSource {
  return { kind: 'directory', name, path: `skills/${name}` }
}

function documentSource(name: string, source: string): LocalSkillSource {
  return {
    description: 'Use when testing document-backed skills.',
    instructions: ['Read only what is relevant for the current task.'],
    kind: 'document',
    name,
    shortDescription: 'document skill',
    source,
    title: 'Document Skill',
  }
}

async function writeRule(root: string, relSource: string): Promise<string> {
  const source = join(root, relSource)
  await mkdir(dirname(source), { recursive: true })
  await writeFile(source, '# Rule\n')
  return source
}

test('linkTargets excludes always-on instructions from Claude skills and links them as rules', () => {
  const codex = linkTargets.find(target => target.kind === 'skill' && target.dir === '~/.codex/skills')
  const claudeSkills = linkTargets.find(target => target.kind === 'skill' && target.dir === '~/.claude/skills')
  const claudeInstructionsTarget = linkTargets.find(target => target.kind === 'rule' && target.dir === '~/.claude/rules')
  assert.ok(codex && claudeSkills && claudeInstructionsTarget)
  if (codex.kind !== 'skill' || claudeSkills.kind !== 'skill' || claudeInstructionsTarget.kind !== 'rule')
    assert.fail('Expected directory link targets')

  // Codex keeps the full skill set (unchanged).
  assert.ok(codex.include.includes('engineering-rules'))
  assert.ok(codex.include.includes('problem-solving-rules'))

  // Claude skills drop the rule-promoted skills...
  assert.equal(claudeSkills.kind, 'skill')
  assert.ok(!claudeSkills.include.includes('engineering-rules'))
  assert.ok(!claudeSkills.include.includes('problem-solving-rules'))
  assert.ok(claudeSkills.include.includes('personal-knowledge'))

  // ...and instead appear under the Claude rules directory.
  assert.equal(claudeInstructionsTarget.kind, 'rule')
  assert.deepEqual(
    [...claudeInstructionsTarget.include].sort(),
    ['engineering-rules', 'problem-solving-rules'],
  )
})

test('linkTargets configures opencode rules and instructions together', () => {
  const opencodeSkills = linkTargets.find(
    target => target.kind === 'skill' && target.dir === '~/.config/opencode/skills',
  )
  const opencodeRules = linkTargets.find(
    target => target.kind === 'rule' && target.dir === '~/.config/opencode/rules',
  )
  const opencodeInstructions = linkTargets.find(
    target => target.kind === 'json-array' && target.file === '~/.config/opencode/opencode.json',
  )
  const opencodePermissions = linkTargets.find(
    target => target.kind === 'json-object' && target.file === '~/.config/opencode/opencode.json',
  )
  assert.ok(opencodeSkills && opencodeRules && opencodeInstructions && opencodePermissions)
  if (opencodeSkills.kind !== 'skill' || opencodeRules.kind !== 'rule')
    assert.fail('Expected opencode directory targets')
  if (opencodeInstructions.kind !== 'json-array')
    assert.fail('Expected opencode config target')
  if (opencodePermissions.kind !== 'json-object')
    assert.fail('Expected opencode permission config target')

  assert.ok(!opencodeSkills.include.includes('engineering-rules'))
  assert.deepEqual(
    [...opencodeRules.include].sort(),
    ['engineering-rules', 'problem-solving-rules'],
  )
  assert.equal(opencodeInstructions.property, 'instructions')
  assert.deepEqual(opencodeInstructions.include, ['~/.config/opencode/rules/*.md'])
  assert.deepEqual(opencodePermissions.path, ['permission', 'external_directory'])
  assert.deepEqual(opencodePermissions.entries, [
    { key: '*', value: 'ask' },
    { key: '{{REPO_ROOT}}/skills/**', value: 'allow' },
  ])
})

test('renders a directory source into generated/<name>/SKILL.md with the repo root resolved', async () => {
  const root = await createTempDir('skills-repo-')
  await createSourceSkill(root, 'engineering-rules')

  const rendered = await renderLocalSkillSources({
    root,
    localSkillSources: [directorySource('engineering-rules')],
  })

  assert.deepEqual(rendered, ['engineering-rules'])
  const skill = await readFile(join(root, 'generated', 'engineering-rules', 'SKILL.md'), 'utf-8')
  assert.equal(skill, `Read \`${root}/rules/engineering/RULES.md\`.\n`)
})

test('renders a document source into generated/<name>/SKILL.md', async () => {
  const root = await createTempDir('skills-repo-')
  await writeRule(root, 'rules/engineering/RULES.md')

  const rendered = await renderLocalSkillSources({
    root,
    localSkillSources: [documentSource('engineering-rules', 'rules/engineering/RULES.md')],
  })

  assert.deepEqual(rendered, ['engineering-rules'])
  const skill = await readFile(join(root, 'generated', 'engineering-rules', 'SKILL.md'), 'utf-8')
  assert.match(skill, /name: engineering-rules/)
  assert.match(skill, new RegExp(`${root}/rules/engineering/RULES\\.md`))
})

test('renders only configured local skill sources', async () => {
  const root = await createTempDir('skills-repo-')
  await createSourceSkill(root, 'engineering-rules')
  await createSourceSkill(root, 'personal-knowledge')

  const rendered = await renderLocalSkillSources({
    root,
    localSkillSources: [directorySource('engineering-rules')],
  })

  assert.deepEqual(rendered, ['engineering-rules'])
  assert.equal(await pathExists(join(root, 'generated', 'engineering-rules', 'SKILL.md')), true)
  assert.equal(await pathExists(join(root, 'generated', 'personal-knowledge', 'SKILL.md')), false)
})

test('throws when a configured directory source is missing', async () => {
  const root = await createTempDir('skills-repo-')

  await assert.rejects(
    () => renderLocalSkillSources({
      root,
      localSkillSources: [directorySource('engineering-rules')],
    }),
    /Missing configured directory skill/,
  )
})

test('copies bundled resources while rendering the generated SKILL.md', async () => {
  const root = await createTempDir('skills-repo-')
  await createSourceSkill(root, 'engineering-rules')
  await mkdir(join(root, 'skills', 'engineering-rules', 'references'), { recursive: true })
  await writeFile(join(root, 'skills', 'engineering-rules', 'references', 'notes.md'), '# Notes\n')

  await renderLocalSkillSources({
    root,
    localSkillSources: [directorySource('engineering-rules')],
  })

  assert.equal(
    await readFile(join(root, 'generated', 'engineering-rules', 'references', 'notes.md'), 'utf-8'),
    '# Notes\n',
  )
  assert.equal(await pathExists(join(root, 'generated', 'engineering-rules', 'SKILL.md')), true)
})

test('links an installable skill by rendering it first', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  await createSourceSkill(root, 'engineering-rules')

  const results = await createSkillLinks({
    root,
    installableSkills: ['engineering-rules'],
    localSkillSources: [directorySource('engineering-rules')],
    targets: [target],
  })

  const source = join(root, 'generated', 'engineering-rules')
  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
  const skill = await readFile(join(source, 'SKILL.md'), 'utf-8')
  assert.equal(skill, `Read \`${root}/rules/engineering/RULES.md\`.\n`)
})

test('discovers directories that contain SKILL.md', async () => {
  const root = await createTempDir('skills-repo-')
  await createGeneratedSkill(root, 'engineering-rules')
  await mkdir(join(root, 'generated', 'not-a-skill'), { recursive: true })

  const skills = await discoverSkills(root)

  assert.deepEqual(skills.map(skill => skill.name), ['engineering-rules'])
  assert.equal(skills[0].source, join(root, 'generated', 'engineering-rules'))
})

test('creates symlinks for each configured installable skill in each target', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createGeneratedSkill(root, 'engineering-rules')
  await createGeneratedSkill(root, 'personal-knowledge')

  const results = await createSkillLinks({
    root,
    installableSkills: ['engineering-rules'],
    localSkillSources: [],
    targets: [target],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
  assert.equal(await pathExists(join(target, 'personal-knowledge')), false)
})

test('throws when a configured installable skill is missing', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')

  await assert.rejects(
    () => createSkillLinks({
      root,
      installableSkills: ['engineering-rules'],
      localSkillSources: [],
      targets: [target],
    }),
    /Missing configured installable skill/,
  )
})

test('linkAll links existing skill dirs, skips missing ones, and writes always-on instructions', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('skills-home-')
  await createGeneratedSkill(root, 'engineering-rules')
  await createGeneratedSkill(root, 'personal-knowledge')
  await writeRule(root, 'rules/engineering/RULES.md')

  const codexSkills = join(home, '.codex', 'skills')
  const claudeSkills = join(home, '.claude', 'skills')
  const claudeInstructionsDir = join(home, '.claude', 'rules')
  const agentsSkills = join(home, '.agents', 'skills')
  await mkdir(codexSkills, { recursive: true })
  await mkdir(claudeSkills, { recursive: true })
  // ~/.agents/skills intentionally absent → skipped, not created.

  const targets = [
    { dir: codexSkills, kind: 'skill' as const, include: ['engineering-rules', 'personal-knowledge'] },
    { dir: agentsSkills, kind: 'skill' as const, include: ['engineering-rules', 'personal-knowledge'] },
    { dir: claudeSkills, kind: 'skill' as const, include: ['personal-knowledge'] },
    { dir: claudeInstructionsDir, kind: 'rule' as const, include: ['engineering-rules'] },
  ]

  await linkAll({
    root,
    targets,
    localSkillSources: [documentSource('engineering-rules', 'rules/engineering/RULES.md')],
  })

  // Codex keeps the full set.
  assert.equal(await pathExists(join(codexSkills, 'engineering-rules')), true)
  assert.equal(await pathExists(join(codexSkills, 'personal-knowledge')), true)
  // Missing tool dir is skipped, not created.
  assert.equal(await pathExists(agentsSkills), false)
  // Claude skills get only personal-knowledge; engineering-rules is excluded...
  assert.equal(await pathExists(join(claudeSkills, 'personal-knowledge')), true)
  assert.equal(await pathExists(join(claudeSkills, 'engineering-rules')), false)
  // ...and lands as a rule markdown instead.
  assert.equal(
    await readlink(join(claudeInstructionsDir, 'engineering-rules.md')),
    join(root, 'rules', 'engineering', 'RULES.md'),
  )
})

test('linkAll writes configured JSON array entries when the config parent exists', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('skills-home-')
  const configFile = join(home, '.config', 'opencode', 'opencode.json')
  await mkdir(dirname(configFile), { recursive: true })
  await writeFile(configFile, '{\n  "$schema": "https://opencode.ai/config.json"\n}\n')

  const targets = [
    {
      file: configFile,
      kind: 'json-array' as const,
      property: 'instructions',
      include: ['~/.config/opencode/rules/*.md'],
    },
    {
      entries: [
        { key: '*', value: 'ask' },
        { key: '{{REPO_ROOT}}/skills/**', value: 'allow' },
      ],
      file: configFile,
      kind: 'json-object' as const,
      path: ['permission', 'external_directory'],
    },
  ]

  await linkAll({ root, targets, localSkillSources: [] })

  const config = JSON.parse(await readFile(configFile, 'utf-8')) as {
    $schema: string
    instructions: string[]
    permission: {
      external_directory: Record<string, string>
    }
  }
  assert.equal(config.$schema, 'https://opencode.ai/config.json')
  assert.deepEqual(config.instructions, ['~/.config/opencode/rules/*.md'])
  assert.deepEqual(config.permission.external_directory, {
    '*': 'ask',
    [`${root}/skills/**`]: 'allow',
  })
})

test('linkAll writes repo-root JSON object keys relative to home when possible', async () => {
  const home = process.env.HOME
  assert.ok(home)
  const root = join(home, 'repo-under-home')
  const configHome = await createTempDir('skills-home-')
  const configFile = join(configHome, '.config', 'opencode', 'opencode.json')
  await mkdir(dirname(configFile), { recursive: true })

  await linkAll({
    root,
    targets: [
      {
        entries: [{ key: '{{REPO_ROOT}}/skills/**', value: 'allow' }],
        file: configFile,
        kind: 'json-object',
        path: ['permission', 'external_directory'],
      },
    ],
    localSkillSources: [],
  })

  const config = JSON.parse(await readFile(configFile, 'utf-8')) as {
    permission: {
      external_directory: Record<string, string>
    }
  }
  assert.deepEqual(config.permission.external_directory, {
    '~/repo-under-home/skills/**': 'allow',
  })
})

test('unlinkAll removes skill and rule links from their targets', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('skills-home-')
  const skillSource = await createGeneratedSkill(root, 'personal-knowledge')
  const ruleSource = await writeRule(root, 'rules/engineering/RULES.md')
  const claudeSkills = join(home, '.claude', 'skills')
  const claudeInstructionsDir = join(home, '.claude', 'rules')
  await mkdir(claudeSkills, { recursive: true })
  await mkdir(claudeInstructionsDir, { recursive: true })
  await symlink(skillSource, join(claudeSkills, 'personal-knowledge'))
  await symlink(ruleSource, join(claudeInstructionsDir, 'engineering-rules.md'))

  const targets = [
    { dir: claudeSkills, kind: 'skill' as const, include: ['personal-knowledge'] },
    { dir: claudeInstructionsDir, kind: 'rule' as const, include: ['engineering-rules'] },
  ]

  await unlinkAll({ root, targets })

  assert.equal(await pathExists(join(claudeSkills, 'personal-knowledge')), false)
  assert.equal(await pathExists(join(claudeInstructionsDir, 'engineering-rules.md')), false)
})

test('runUnlink --target prunes both skill and rule links from one directory', async () => {
  const root = repoRoot()
  const target = await createTempDir('mixed-target-')
  // Dangling links are still recognised as repo-owned, so the sources need not
  // exist. One points into repo generated/, one into repo rules/.
  await symlink(join(root, 'generated', 'personal-knowledge'), join(target, 'personal-knowledge'))
  await symlink(join(root, 'rules', 'engineering', 'RULES.md'), join(target, 'engineering-rules.md'))
  await symlink('/tmp/elsewhere.md', join(target, 'foreign.md'))

  await runUnlink(['--target', target])

  assert.equal(await pathExists(join(target, 'personal-knowledge')), false)
  assert.equal(await pathExists(join(target, 'engineering-rules.md')), false)
  assert.equal(await readlink(join(target, 'foreign.md')), '/tmp/elsewhere.md')
})

test('keeps an existing correct symlink', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createGeneratedSkill(root, 'engineering-rules')
  await symlink(source, join(target, 'engineering-rules'))

  const results = await createSkillLinks({
    root,
    installableSkills: ['engineering-rules'],
    localSkillSources: [],
    targets: [target],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'exists' }])
})

test('updates repo-owned symlinks that point at the old source directory', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createGeneratedSkill(root, 'engineering-rules')
  await createSourceSkill(root, 'engineering-rules')
  await symlink(join(root, 'skills', 'engineering-rules'), join(target, 'engineering-rules'))

  const results = await createSkillLinks({
    root,
    installableSkills: ['engineering-rules'],
    localSkillSources: [],
    targets: [target],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'updated' }])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
})

test('does not overwrite non-symlink entries', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  await createGeneratedSkill(root, 'engineering-rules')
  await mkdir(join(target, 'engineering-rules'))

  await assert.rejects(
    () => createSkillLinks({
      root,
      installableSkills: ['engineering-rules'],
      localSkillSources: [],
      targets: [target],
    }),
    /Refusing to replace non-symlink/,
  )
})

test('removes only symlinks that point to repo generated', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createGeneratedSkill(root, 'engineering-rules')
  await symlink(source, join(target, 'engineering-rules'))
  await symlink('/tmp/elsewhere', join(target, 'other-skill'))

  const results = await removeSkillLinks({ root, targets: [target] })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'removed' }])
  await assert.rejects(() => readlink(join(target, 'engineering-rules')), /ENOENT/)
  assert.equal(await readlink(join(target, 'other-skill')), '/tmp/elsewhere')
})

test('removes dangling links left behind by deleted skills', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  // A skill that was linked previously, then deleted from the repo.
  await symlink(join(root, 'generated', 'gsap-core'), join(target, 'gsap-core'))

  const results = await removeSkillLinks({ root, targets: [target] })

  assert.deepEqual(results, [{ name: 'gsap-core', target, status: 'removed' }])
  await assert.rejects(() => readlink(join(target, 'gsap-core')), /ENOENT/)
})

test('prunes dangling links for deleted skills when linking', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createGeneratedSkill(root, 'engineering-rules')
  // Stale link from a skill that no longer exists in the repo.
  await symlink(join(root, 'generated', 'gsap-core'), join(target, 'gsap-core'))

  const results = await createSkillLinks({
    root,
    installableSkills: ['engineering-rules'],
    localSkillSources: [],
    targets: [target],
  })

  assert.deepEqual(results, [
    { name: 'engineering-rules', target, status: 'linked' },
    { name: 'gsap-core', target, status: 'removed' },
  ])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
  await assert.rejects(() => readlink(join(target, 'gsap-core')), /ENOENT/)
})

test('links configured always-on instructions as markdown into the rules target', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('rules-target-')
  const source = await writeRule(root, 'rules/engineering/RULES.md')

  const results = await createRuleLinks({
    instructions: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
    root,
    targets: [target],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules.md', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules.md')), source)
})

test('merges JSON array config entries without duplicating existing values', async () => {
  const home = await createTempDir('config-home-')
  const file = join(home, 'opencode.json')
  await writeFile(file, JSON.stringify({
    instructions: [
      'AGENTS.md',
      '~/.config/opencode/rules/*.md',
    ],
    theme: 'system',
  }, null, 2))

  const results = await ensureJsonArrayEntries({
    file,
    property: 'instructions',
    values: ['~/.config/opencode/rules/*.md', 'project-rules/*.md'],
  })

  assert.deepEqual(results, [{ name: 'instructions', target: file, status: 'updated' }])
  assert.deepEqual(JSON.parse(await readFile(file, 'utf-8')), {
    instructions: [
      'AGENTS.md',
      '~/.config/opencode/rules/*.md',
      'project-rules/*.md',
    ],
    theme: 'system',
  })
})

test('merges JSON object config entries without disturbing unrelated keys', async () => {
  const home = await createTempDir('config-home-')
  const file = join(home, 'opencode.json')
  await writeFile(file, JSON.stringify({
    permission: {
      external_directory: {
        '/tmp/project/**': 'allow',
      },
    },
    provider: {},
    theme: 'system',
  }, null, 2))

  const results = await ensureJsonObjectEntries({
    entries: [
      { key: '*', value: 'ask' },
      { key: '/Users/me/skills/skills/**', value: 'allow' },
    ],
    file,
    path: ['permission', 'external_directory'],
  })

  assert.deepEqual(results, [{ name: 'permission.external_directory', target: file, status: 'updated' }])
  assert.deepEqual(JSON.parse(await readFile(file, 'utf-8')), {
    permission: {
      external_directory: {
        '/tmp/project/**': 'allow',
        '*': 'ask',
        '/Users/me/skills/skills/**': 'allow',
      },
    },
    provider: {},
    theme: 'system',
  })
})

test('creates the rules target directory when missing', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('rules-home-')
  const target = join(home, 'rules')
  await writeRule(root, 'rules/engineering/RULES.md')

  await createRuleLinks({
    instructions: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
    root,
    targets: [target],
  })

  assert.equal(await pathExists(join(target, 'engineering-rules.md')), true)
})

test('throws when a configured rule source is missing', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('rules-target-')

  await assert.rejects(
    () => createRuleLinks({
      instructions: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
      root,
      targets: [target],
    }),
    /Missing configured instruction source/,
  )
})

test('prunes stale rule links but leaves foreign links', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('rules-target-')
  const source = await writeRule(root, 'rules/engineering/RULES.md')
  // Stale link into repo rules whose source rule is no longer configured.
  await symlink(join(root, 'rules', 'old', 'RULES.md'), join(target, 'old-rules.md'))
  // Foreign link outside repo rules must be left untouched.
  await symlink('/tmp/elsewhere.md', join(target, 'foreign.md'))

  const results = await createRuleLinks({
    instructions: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
    root,
    targets: [target],
  })

  assert.deepEqual(results, [
    { name: 'engineering-rules.md', target, status: 'linked' },
    { name: 'old-rules.md', target, status: 'removed' },
  ])
  assert.equal(await readlink(join(target, 'engineering-rules.md')), source)
  await assert.rejects(() => readlink(join(target, 'old-rules.md')), /ENOENT/)
  assert.equal(await readlink(join(target, 'foreign.md')), '/tmp/elsewhere.md')
})

test('removes only rule links that point into repo rules', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('rules-target-')
  const source = await writeRule(root, 'rules/engineering/RULES.md')
  await symlink(source, join(target, 'engineering-rules.md'))
  await symlink('/tmp/elsewhere.md', join(target, 'foreign.md'))

  const results = await removeRuleLinks({ root, targets: [target] })

  assert.deepEqual(results, [{ name: 'engineering-rules.md', target, status: 'removed' }])
  await assert.rejects(() => readlink(join(target, 'engineering-rules.md')), /ENOENT/)
  assert.equal(await readlink(join(target, 'foreign.md')), '/tmp/elsewhere.md')
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
