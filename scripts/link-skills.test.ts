import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createSkillLinks,
  DEFAULT_TARGETS,
  discoverSkills,
  removeSkillLinks,
} from './link-skills.ts'

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

test('defaults to Codex and Claude skill directories', () => {
  assert.deepEqual(DEFAULT_TARGETS, [
    '~/.codex/skills',
    '~/.claude/skills',
    '~/.agents/skills',
  ])
})

test('discovers directories that contain SKILL.md', async () => {
  const root = await createTempDir('skills-repo-')
  await createSkill(root, 'engineering-rules')
  await mkdir(join(root, 'skills', 'not-a-skill'), { recursive: true })

  const skills = await discoverSkills(root)

  assert.deepEqual(skills.map(skill => skill.name), ['engineering-rules'])
  assert.equal(skills[0].source, join(root, 'skills', 'engineering-rules'))
})

test('creates symlinks for each discovered skill in each target', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createSkill(root, 'engineering-rules')

  const results = await createSkillLinks({ root, targets: [target] })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'linked' }])
  assert.equal(await readlink(join(target, 'engineering-rules')), source)
})

test('keeps an existing correct symlink', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  const source = await createSkill(root, 'engineering-rules')
  await symlink(source, join(target, 'engineering-rules'))

  const results = await createSkillLinks({ root, targets: [target] })

  assert.deepEqual(results, [{ name: 'engineering-rules', target, status: 'exists' }])
})

test('does not overwrite non-symlink entries', async () => {
  const root = await createTempDir('skills-repo-')
  const target = await createTempDir('skills-target-')
  await createSkill(root, 'engineering-rules')
  await mkdir(join(target, 'engineering-rules'))

  await assert.rejects(
    () => createSkillLinks({ root, targets: [target] }),
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

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
