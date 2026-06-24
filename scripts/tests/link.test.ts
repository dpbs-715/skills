import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { linkTargets } from '../../meta.ts'
import { linkAll, runUnlink, unlinkAll } from '../commands/link.ts'
import { createRuleLinks, removeRuleLinks } from '../lib/ruleLinks.ts'
import {
  createSkillLinks,
  discoverSkills,
  removeSkillLinks,
  renderSkillTemplates,
  REPO_ROOT_TOKEN,
} from '../lib/skillLinks.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

const temporaryPaths: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

async function createSkill(root: string, name: string): Promise<string> {
  const skillDir = join(root, 'skills', name)
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: Use when testing.\n---\n`)
  return skillDir
}

async function createSkillTemplate(root: string, name: string): Promise<void> {
  const templateDir = join(root, 'templates', name)
  await mkdir(templateDir, { recursive: true })
  await writeFile(
    join(templateDir, 'SKILL.md'),
    `Read \`${REPO_ROOT_TOKEN}/rules/engineering/RULES.md\`.\n`,
  )
}

async function writeRule(root: string, relSource: string): Promise<string> {
  const source = join(root, relSource)
  await mkdir(dirname(source), { recursive: true })
  await writeFile(source, '# Rule\n')
  return source
}

test('linkTargets excludes Claude rules from Claude skills and links them as rules', () => {
  const codex = linkTargets.find(target => target.dir === '~/.codex/skills')
  const claudeSkills = linkTargets.find(target => target.dir === '~/.claude/skills')
  const claudeRulesTarget = linkTargets.find(target => target.dir === '~/.claude/rules')
  assert.ok(codex && claudeSkills && claudeRulesTarget)

  // Codex keeps the full skill set (unchanged).
  assert.ok(codex.include.includes('engineering-rules'))
  assert.ok(codex.include.includes('problem-solving-rules'))

  // Claude skills drop the rule-promoted skills...
  assert.equal(claudeSkills.kind, 'skill')
  assert.ok(!claudeSkills.include.includes('engineering-rules'))
  assert.ok(!claudeSkills.include.includes('problem-solving-rules'))
  assert.ok(claudeSkills.include.includes('personal-knowledge'))

  // ...and instead appear under the Claude rules target.
  assert.equal(claudeRulesTarget.kind, 'rule')
  assert.deepEqual(
    [...claudeRulesTarget.include].sort(),
    ['engineering-rules', 'problem-solving-rules'],
  )
})

test('renders a template into skills/<name>/SKILL.md with the repo root resolved', async () => {
  const root = await createTempDir('skills-repo-')
  await createSkillTemplate(root, 'engineering-rules')

  const rendered = await renderSkillTemplates({
    root,
    templateSkills: ['engineering-rules'],
  })

  assert.deepEqual(rendered, ['engineering-rules'])
  const skill = await readFile(join(root, 'skills', 'engineering-rules', 'SKILL.md'), 'utf-8')
  assert.equal(skill, `Read \`${root}/rules/engineering/RULES.md\`.\n`)
})

test('renders only configured skill templates', async () => {
  const root = await createTempDir('skills-repo-')
  await createSkillTemplate(root, 'engineering-rules')
  await createSkillTemplate(root, 'personal-knowledge')

  const rendered = await renderSkillTemplates({
    root,
    templateSkills: ['engineering-rules'],
  })

  assert.deepEqual(rendered, ['engineering-rules'])
  assert.equal(await pathExists(join(root, 'skills', 'engineering-rules', 'SKILL.md')), true)
  assert.equal(await pathExists(join(root, 'skills', 'personal-knowledge', 'SKILL.md')), false)
})

test('throws when a configured skill template is missing', async () => {
  const root = await createTempDir('skills-repo-')

  await assert.rejects(
    () => renderSkillTemplates({
      root,
      templateSkills: ['engineering-rules'],
    }),
    /Missing configured skill template/,
  )
})

test('does not render templates into the linked skill directory', async () => {
  const root = await createTempDir('skills-repo-')
  await createSkillTemplate(root, 'engineering-rules')

  await renderSkillTemplates({
    root,
    templateSkills: ['engineering-rules'],
  })

  assert.equal(await pathExists(join(root, 'skills', 'engineering-rules', 'SKILL.template.md')), false)
  assert.equal(await pathExists(join(root, 'skills', 'engineering-rules', 'SKILL.md')), true)
})

test('links a templated skill by rendering it first', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  await createSkillTemplate(root, 'engineering-rules')

  const results = await createSkillLinks({
    root,
    linkedSkills: ['engineering-rules'],
    targets: [target],
    templateSkills: ['engineering-rules'],
  })

  const source = join(root, 'skills', 'engineering-rules')
  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
  const skill = await readFile(join(source, 'SKILL.md'), 'utf-8')
  assert.equal(skill, `Read \`${root}/rules/engineering/RULES.md\`.\n`)
})

test('discovers directories that contain SKILL.md', async () => {
  const root = await createTempDir('skills-repo-')
  await createSkill(root, 'engineering-rules')
  await mkdir(join(root, 'skills', 'not-a-skill'), { recursive: true })

  const skills = await discoverSkills(root)

  assert.deepEqual(skills.map(skill => skill.name), ['engineering-rules'])
  assert.equal(skills[0].source, join(root, 'skills', 'engineering-rules'))
})

test('creates symlinks for each configured linked skill in each target', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createSkill(root, 'engineering-rules')
  await createSkill(root, 'personal-knowledge')

  const results = await createSkillLinks({
    root,
    linkedSkills: ['engineering-rules'],
    targets: [target],
    templateSkills: [],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
  assert.equal(await pathExists(join(target, 'personal-knowledge')), false)
})

test('throws when a configured linked skill is missing', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')

  await assert.rejects(
    () => createSkillLinks({
      root,
      linkedSkills: ['engineering-rules'],
      targets: [target],
      templateSkills: [],
    }),
    /Missing configured linked skill/,
  )
})

test('linkAll links existing skill dirs, skips missing ones, and writes Claude rules', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('skills-home-')
  await createSkill(root, 'engineering-rules')
  await createSkill(root, 'personal-knowledge')
  await writeRule(root, 'rules/engineering/RULES.md')

  const codexSkills = join(home, '.codex', 'skills')
  const claudeSkills = join(home, '.claude', 'skills')
  const claudeRulesDir = join(home, '.claude', 'rules')
  const agentsSkills = join(home, '.agents', 'skills')
  await mkdir(codexSkills, { recursive: true })
  await mkdir(claudeSkills, { recursive: true })
  // ~/.agents/skills intentionally absent → skipped, not created.

  const targets = [
    { dir: codexSkills, kind: 'skill' as const, include: ['engineering-rules', 'personal-knowledge'] },
    { dir: agentsSkills, kind: 'skill' as const, include: ['engineering-rules', 'personal-knowledge'] },
    { dir: claudeSkills, kind: 'skill' as const, include: ['personal-knowledge'] },
    { dir: claudeRulesDir, kind: 'rule' as const, include: ['engineering-rules'] },
  ]

  await linkAll({ root, targets, templateSkills: [] })

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
    await readlink(join(claudeRulesDir, 'engineering-rules.md')),
    join(root, 'rules', 'engineering', 'RULES.md'),
  )
})

test('unlinkAll removes skill and rule links from their targets', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('skills-home-')
  const skillSource = await createSkill(root, 'personal-knowledge')
  const ruleSource = await writeRule(root, 'rules/engineering/RULES.md')
  const claudeSkills = join(home, '.claude', 'skills')
  const claudeRulesDir = join(home, '.claude', 'rules')
  await mkdir(claudeSkills, { recursive: true })
  await mkdir(claudeRulesDir, { recursive: true })
  await symlink(skillSource, join(claudeSkills, 'personal-knowledge'))
  await symlink(ruleSource, join(claudeRulesDir, 'engineering-rules.md'))

  const targets = [
    { dir: claudeSkills, kind: 'skill' as const, include: ['personal-knowledge'] },
    { dir: claudeRulesDir, kind: 'rule' as const, include: ['engineering-rules'] },
  ]

  await unlinkAll({ root, targets })

  assert.equal(await pathExists(join(claudeSkills, 'personal-knowledge')), false)
  assert.equal(await pathExists(join(claudeRulesDir, 'engineering-rules.md')), false)
})

test('runUnlink --target prunes both skill and rule links from one directory', async () => {
  const root = repoRoot()
  const target = await createTempDir('mixed-target-')
  // Dangling links are still recognised as repo-owned, so the sources need not
  // exist. One points into repo skills/, one into repo rules/.
  await symlink(join(root, 'skills', 'personal-knowledge'), join(target, 'personal-knowledge'))
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
  const source = await createSkill(root, 'engineering-rules')
  await symlink(source, join(target, 'engineering-rules'))

  const results = await createSkillLinks({
    root,
    linkedSkills: ['engineering-rules'],
    targets: [target],
    templateSkills: [],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'exists' }])
})

test('does not overwrite non-symlink entries', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  await createSkill(root, 'engineering-rules')
  await mkdir(join(target, 'engineering-rules'))

  await assert.rejects(
    () => createSkillLinks({
      root,
      linkedSkills: ['engineering-rules'],
      targets: [target],
      templateSkills: [],
    }),
    /Refusing to replace non-symlink/,
  )
})

test('removes only symlinks that point to repo skills', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createSkill(root, 'engineering-rules')
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
  await symlink(join(root, 'skills', 'gsap-core'), join(target, 'gsap-core'))

  const results = await removeSkillLinks({ root, targets: [target] })

  assert.deepEqual(results, [{ name: 'gsap-core', target, status: 'removed' }])
  await assert.rejects(() => readlink(join(target, 'gsap-core')), /ENOENT/)
})

test('prunes dangling links for deleted skills when linking', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createSkill(root, 'engineering-rules')
  // Stale link from a skill that no longer exists in the repo.
  await symlink(join(root, 'skills', 'gsap-core'), join(target, 'gsap-core'))

  const results = await createSkillLinks({
    root,
    linkedSkills: ['engineering-rules'],
    targets: [target],
    templateSkills: [],
  })

  assert.deepEqual(results, [
    { name: 'engineering-rules', target, status: 'linked' },
    { name: 'gsap-core', target, status: 'removed' },
  ])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
  await assert.rejects(() => readlink(join(target, 'gsap-core')), /ENOENT/)
})

test('links configured Claude rules as markdown into the rules target', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('rules-target-')
  const source = await writeRule(root, 'rules/engineering/RULES.md')

  const results = await createRuleLinks({
    root,
    rules: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
    targets: [target],
  })

  assert.deepEqual(results, [{ name: 'engineering-rules.md', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules.md')), source)
})

test('creates the rules target directory when missing', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('rules-home-')
  const target = join(home, 'rules')
  await writeRule(root, 'rules/engineering/RULES.md')

  await createRuleLinks({
    root,
    rules: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
    targets: [target],
  })

  assert.equal(await pathExists(join(target, 'engineering-rules.md')), true)
})

test('throws when a configured rule source is missing', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('rules-target-')

  await assert.rejects(
    () => createRuleLinks({
      root,
      rules: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
      targets: [target],
    }),
    /Missing configured rule source/,
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
    root,
    rules: [{ skill: 'engineering-rules', source: 'rules/engineering/RULES.md' }],
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
