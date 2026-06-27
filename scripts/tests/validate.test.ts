import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import type { ClaudeRule } from '../../meta.ts'
import { run as runValidate } from '../commands/validate.ts'
import { REPO_ROOT_TOKEN } from '../lib/skillLinks.ts'
import { type ValidationOptions, validateSkills } from '../lib/validation.ts'

const temporaryPaths: string[] = []
const skillName = 'engineering-rules'
const defaultRuleSource = 'rules/engineering/RULES.md'

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

async function writeRepoFile(root: string, relPath: string, content: string): Promise<void> {
  const path = join(root, relPath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

function skillTemplate(ruleSource = defaultRuleSource): string {
  return `---
name: ${skillName}
description: Use when testing validation.
---

# Engineering Rules

Read \`${REPO_ROOT_TOKEN}/${ruleSource}\`.
`
}

async function createValidRepo({
  claudeRules = [{ skill: skillName, source: defaultRuleSource }],
  ruleSource = defaultRuleSource,
  writeRule = true,
}: {
  claudeRules?: readonly ClaudeRule[]
  ruleSource?: string
  writeRule?: boolean
} = {}): Promise<{ options: ValidationOptions, root: string }> {
  const root = await createTempDir('skills-validate-')
  const template = skillTemplate(ruleSource)

  await writeRepoFile(root, join('templates', skillName, 'SKILL.md'), template)
  await writeRepoFile(
    root,
    join('skills', skillName, 'SKILL.md'),
    template.replaceAll(REPO_ROOT_TOKEN, root),
  )
  if (writeRule)
    await writeRepoFile(root, ruleSource, '# Rule\n')

  return {
    root,
    options: {
      claudeRules,
      linkedSkills: [skillName],
      root,
      templateSkills: [skillName],
    },
  }
}

function issueCodes(result: Awaited<ReturnType<typeof validateSkills>>): string[] {
  return result.issues.map(issue => issue.code).sort()
}

async function captureLogs(action: () => Promise<void>): Promise<string[]> {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (message?: unknown, ...optionalParams: unknown[]) => {
    logs.push([message, ...optionalParams].map(String).join(' '))
  }

  try {
    await action()
  }
  finally {
    console.log = originalLog
  }

  return logs
}

test('validateSkills passes for a current generated skill set', async () => {
  const { options } = await createValidRepo()

  const result = await validateSkills(options)

  assert.deepEqual(result, { issues: [], ok: true })
})

test('run prints a clear success message', async () => {
  const { options } = await createValidRepo()

  const logs = await captureLogs(() => runValidate([], options))

  assert.deepEqual(logs, ['Validation passed.'])
})

test('reports a missing configured template', async () => {
  const { options, root } = await createValidRepo()
  await rm(join(root, 'templates', skillName, 'SKILL.md'), { force: true })

  const result = await validateSkills(options)

  assert.equal(result.ok, false)
  assert.deepEqual(issueCodes(result), ['missing-template'])
  assert.equal(result.issues[0].path, join('templates', skillName, 'SKILL.md'))
})

test('reports a stale generated skill', async () => {
  const { options, root } = await createValidRepo()
  await writeRepoFile(
    root,
    join('skills', skillName, 'SKILL.md'),
    `---
name: ${skillName}
description: Use when testing validation.
---

# Stale
`,
  )

  const result = await validateSkills(options)

  assert.equal(result.ok, false)
  assert.deepEqual(issueCodes(result), ['stale-generated-skill'])
})

test('reports discovered skill frontmatter problems', async () => {
  const root = await createTempDir('skills-validate-')
  await writeRepoFile(root, join('skills', 'missing-frontmatter', 'SKILL.md'), '# Missing\n')
  await writeRepoFile(
    root,
    join('skills', 'name-mismatch', 'SKILL.md'),
    `---
name: other-name
description: Use when testing validation.
---
`,
  )

  const result = await validateSkills({
    claudeRules: [],
    linkedSkills: [],
    root,
    templateSkills: [],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(issueCodes(result), ['missing-frontmatter', 'skill-name-mismatch'])
})

test('reports a missing configured Claude rule source', async () => {
  const { options } = await createValidRepo({
    claudeRules: [{ skill: skillName, source: 'rules/missing/RULES.md' }],
  })

  const result = await validateSkills(options)

  assert.equal(result.ok, false)
  assert.deepEqual(issueCodes(result), ['missing-rule-source'])
  assert.equal(result.issues[0].path, 'rules/missing/RULES.md')
})

test('reports a missing configured linked skill', async () => {
  const root = await createTempDir('skills-validate-')

  const result = await validateSkills({
    claudeRules: [],
    linkedSkills: [skillName],
    root,
    templateSkills: [],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(issueCodes(result), ['missing-linked-skill'])
})

test('reports missing repo absolute paths in templates and generated skills', async () => {
  const { options } = await createValidRepo({
    claudeRules: [],
    ruleSource: 'rules/missing/RULES.md',
    writeRule: false,
  })

  const result = await validateSkills(options)

  assert.equal(result.ok, false)
  assert.deepEqual(issueCodes(result), ['missing-absolute-path', 'missing-absolute-path'])
  assert.deepEqual(
    result.issues.map(issue => issue.path).sort(),
    [
      join('skills', skillName, 'SKILL.md'),
      join('templates', skillName, 'SKILL.md'),
    ],
  )
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
