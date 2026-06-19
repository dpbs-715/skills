import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createSkillLinks,
  DEFAULT_TARGETS,
  discoverSkills,
  removeSkillLinks,
  renderSkillTemplates,
  REPO_ROOT_TOKEN,
} from '../commands/link.ts'
import { pathExists } from '../lib/utils.ts'

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

test('defaults to Codex and Claude skill directories', () => {
  assert.deepEqual(DEFAULT_TARGETS, [
    '~/.codex/skills',
    '~/.claude/skills',
    '~/.agents/skills',
  ])
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

test('skips missing default targets instead of creating them', async () => {
  const root = await createTempDir('skills-repo-')
  const home = await createTempDir('skills-home-')
  const source = await createSkill(root, 'engineering-rules')
  const codexTarget = join(home, '.codex', 'skills')
  const claudeTarget = join(home, '.claude', 'skills')
  const agentsTarget = join(home, '.agents', 'skills')
  await mkdir(codexTarget, { recursive: true })
  await mkdir(claudeTarget, { recursive: true })

  const previousHome = process.env.HOME
  process.env.HOME = home
  try {
    const results = await createSkillLinks({
      root,
      linkedSkills: ['engineering-rules'],
      templateSkills: [],
    })

    assert.deepEqual(results, [
      { name: 'engineering-rules', target: codexTarget, status: 'linked' },
      { name: 'engineering-rules', target: claudeTarget, status: 'linked' },
    ])
    assert.equal(await readlink(join(codexTarget, 'engineering-rules')), source)
    assert.equal(await readlink(join(claudeTarget, 'engineering-rules')), source)
    assert.equal(await pathExists(agentsTarget), false)
  }
  finally {
    if (previousHome === undefined)
      delete process.env.HOME
    else
      process.env.HOME = previousHome
  }
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

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
