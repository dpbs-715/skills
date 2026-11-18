import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import test, { type TestContext } from 'node:test'

import { feedbackEnabled, reportFeedback, setFeedbackEnabled } from '../lib/skillFeedback.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

const input = {
  component: 'create-pr', source: 'skills/create-pr/SKILL.md',
  title: 'An option is rejected', impact: 'A workaround was required.',
  operation: 'tool --fixture', failure: 'unknown option',
  steps: 'Run the documented command in a fixture. It fails instead of creating a draft.',
  cause: 'The guide lists an unavailable option.',
  recommendation: 'Use the supported option and rerun the fixture.',
}

async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'feedback-test-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
  await writeFile(join(root, 'meta.template.ts'), `export const localSkillSources = ${JSON.stringify([
    { kind: 'directory', name: 'create-pr', path: 'skills/create-pr' },
    { kind: 'directory', name: 'third-party', path: 'vendor/third-party' },
    { kind: 'document', name: 'engineering-rules', source: 'rules/engineering/RULES.md' },
  ])}`)
  for (const source of [input.source, 'skills/create-pr/locally-modified.md', 'rules/engineering/topics/fixture.md', 'agents/fixture-role/AGENT.md']) {
    await mkdir(dirname(join(root, source)), { recursive: true })
    await writeFile(join(root, source), '# Fixture source\n')
  }
  return { root, directory: join(root, 'local', 'skill-feedback', 'reports') }
}

async function cliFixture(t: TestContext) {
  const { root, directory } = await fixture(t)
  await cp(join(repoRoot(), 'scripts'), join(root, 'scripts'), {
    recursive: true,
    filter: source => source !== join(repoRoot(), 'scripts/tests'),
  })
  await symlink(join(repoRoot(), 'node_modules'), join(root, 'node_modules'), 'dir')
  const cli = join(root, 'scripts', 'skills.ts')
  const run = (args: string[], stdin?: string) => new Promise<string>((resolve, reject) => {
    const child = execFile(process.execPath, [cli, 'feedback', ...args], {
      cwd: root, env: { ...process.env, PATH: join(root, 'no-binaries') },
    }, (error, stdout) => {
      if (error)
        reject(error)
      else
        resolve(stdout.trim())
    })
    child.stdin?.end(stdin)
  })
  return { root, directory, run }
}

test('collection is opt-in and disabling it preserves saved reports', async (t) => {
  const { root, directory } = await fixture(t)
  assert.equal(await feedbackEnabled(root), false)
  await setFeedbackEnabled(false, root)
  assert.deepEqual(await reportFeedback(input, root), { status: 'disabled' })
  assert.equal(await pathExists(join(root, 'local')), false)

  await setFeedbackEnabled(true, root)
  await setFeedbackEnabled(true, root)
  assert.equal(await feedbackEnabled(root), true)
  assert.equal(await pathExists(directory), false)
  const result = await reportFeedback(input, root)
  assert.equal(result.status, 'saved')

  await setFeedbackEnabled(false, root)
  assert.equal(await feedbackEnabled(root), false)
  assert.deepEqual(await reportFeedback({ ...input, failure: 'another failure' }, root), { status: 'disabled' })
  assert.equal((await readdir(directory)).length, 1)
  assert.ok((await readFile(result.path, 'utf8')).includes(input.failure))
})

test('saves private Markdown and reuses the first report with the same signature', async (t) => {
  const { root, directory } = await fixture(t)
  await setFeedbackEnabled(true, root)
  const sourceDigest = 'a'.repeat(64)
  const first = await reportFeedback({ ...input, sourceDigest }, root)
  assert.equal(first.status, 'saved')
  assert.equal(dirname(first.path), directory)
  assert.match(first.path, /\/[a-f0-9]{64}\.md$/)
  const body = await readFile(first.path, 'utf8')
  for (const detail of [input.title, input.source, input.impact, input.operation, input.failure, input.steps, input.cause, input.recommendation, sourceDigest])
    assert.ok(body.includes(detail))
  if (process.getuid) {
    assert.equal((await lstat(directory)).mode & 0o777, 0o700)
    assert.equal((await lstat(first.path)).mode & 0o777, 0o600)
  }
  assert.deepEqual(await reportFeedback({ ...input, title: 'Later report', steps: 'Different steps' }, root),
    { status: 'existing', path: first.path })
  assert.equal(await readFile(first.path, 'utf8'), body)
  const different = await reportFeedback({ ...input, failure: 'different failure' }, root)
  assert.equal(different.status, 'saved')
  assert.notEqual(different.path, first.path)
  assert.equal((await readdir(directory)).length, 2)
})

test('accepts maintained local sources without Git or an upstream digest and rejects invalid inputs', async (t) => {
  const { root } = await fixture(t)
  await setFeedbackEnabled(true, root)
  for (const [component, source] of [
    ['create-pr', 'skills/create-pr/locally-modified.md'],
    ['engineering-rules', 'rules/engineering/topics/fixture.md'],
    ['fixture-role', 'agents/fixture-role/AGENT.md'],
  ]) {
    assert.equal((await reportFeedback({ ...input, component, source }, root)).status, 'saved')
  }
  await assert.rejects(reportFeedback({ ...input, source: 'skills/create-pr/../outside.md' }, root), /repository-relative/)
  await assert.rejects(reportFeedback({ ...input, source: '/tmp/local-file' }, root), /repository-relative/)
  await assert.rejects(reportFeedback({ ...input, source: 'skills/unrelated/SKILL.md' }, root), /not maintained/)
  await assert.rejects(reportFeedback({ ...input, component: 'third-party', source: 'vendor/third-party/SKILL.md' }, root), /not maintained/)
  await mkdir(join(root, 'skills', 'create-pr', 'folder.md'))
  await symlink(join(root, input.source), join(root, 'skills', 'create-pr', 'alias.md'))
  await symlink(join(root, 'rules'), join(root, 'skills', 'create-pr', 'linked-rules'), 'dir')
  for (const source of ['skills/create-pr/missing.md', 'skills/create-pr/folder.md', 'skills/create-pr/alias.md', 'skills/create-pr/linked-rules/engineering/topics/fixture.md']) {
    await assert.rejects(reportFeedback({ ...input, source }, root), /existing checkout-local regular file/)
  }
  await assert.rejects(reportFeedback({ ...input, component: 'missing-role', source: 'agents/missing-role/AGENT.md' }, root), /existing checkout-local regular file/)
  await assert.rejects(reportFeedback({ ...input, operation: 'first\nsecond' }, root), /single lines/)
  await assert.rejects(reportFeedback({ ...input, cause: '' }, root), /Feedback cause/)
  await assert.rejects(reportFeedback({ ...input, sourceDigest: 'invalid' }, root), /SHA-256/)
})

test('normalizes source paths from custom configuration without loosening report paths', async (t) => {
  const { root } = await fixture(t)
  await writeFile(join(root, 'rules/engineering/RULES.md'), '# Fixture rule\n')
  await writeFile(join(root, 'meta.ts'), `export const localSkillSources = ${JSON.stringify([
    { kind: 'directory', name: 'create-pr', path: './skills/create-pr' },
    { kind: 'directory', name: 'trailing-slash', path: 'skills/create-pr/' },
    { kind: 'document', name: 'engineering-rules', source: './rules/engineering/RULES.md' },
  ])}`)
  await setFeedbackEnabled(true, root)
  for (const [component, source] of [
    ['create-pr', input.source],
    ['trailing-slash', input.source],
    ['engineering-rules', 'rules/engineering/topics/fixture.md'],
  ]) {
    assert.equal((await reportFeedback({ ...input, component, source }, root)).status, 'saved')
  }
  await assert.rejects(reportFeedback({ ...input, source: `./${input.source}` }, root), /repository-relative/)
})

test('linked opt-in paths cannot grant or change consent in another checkout', async (t) => {
  const first = await fixture(t)
  const second = await fixture(t)
  await setFeedbackEnabled(true, first.root)
  for (const path of ['local', 'local/skill-feedback']) {
    const destination = join(second.root, path)
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    await symlink(join(first.root, path), destination)
    assert.equal(await feedbackEnabled(second.root), false)
    assert.deepEqual(await reportFeedback(input, second.root), { status: 'disabled' })
    await assert.rejects(setFeedbackEnabled(true, second.root))
    await setFeedbackEnabled(false, second.root)
    assert.equal(await feedbackEnabled(first.root), true)
    await rm(destination)
  }
})

test('disable removes an invalid marker link without changing its target', async (t) => {
  const first = await fixture(t)
  const second = await fixture(t)
  await setFeedbackEnabled(true, first.root)
  await setFeedbackEnabled(true, second.root)
  const target = join(dirname(first.directory), 'enabled')
  const marker = join(dirname(second.directory), 'enabled')
  await rm(marker)
  await symlink(target, marker)
  assert.equal(await feedbackEnabled(second.root), false)
  assert.deepEqual(await reportFeedback(input, second.root), { status: 'disabled' })
  await assert.rejects(setFeedbackEnabled(true, second.root), /disable collection before enabling/)
  await setFeedbackEnabled(false, second.root)
  assert.equal(await pathExists(marker), false)
  assert.equal(await feedbackEnabled(first.root), true)
  await setFeedbackEnabled(true, second.root)
  assert.equal(await feedbackEnabled(second.root), true)

  await rm(marker)
  await mkdir(marker)
  await assert.rejects(setFeedbackEnabled(false, second.root), /marker is a directory; move it out of the way/)
  assert.equal((await lstat(marker)).isDirectory(), true)
})

test('refuses linked report directories and report files without altering their targets', async (t) => {
  const { root, directory } = await fixture(t)
  const outside = await fixture(t)
  await setFeedbackEnabled(true, root)
  await mkdir(outside.directory, { recursive: true, mode: 0o700 })
  await symlink(outside.directory, directory)
  await assert.rejects(reportFeedback(input, root), /directories without symlinks/)
  assert.deepEqual(await readdir(outside.directory), [])
  await rm(directory)

  const report = await reportFeedback(input, root)
  assert.equal(report.status, 'saved')
  const target = join(outside.directory, 'unchanged.md')
  await writeFile(target, 'Original\n', { mode: 0o600 })
  await rm(report.path)
  await symlink(target, report.path)
  await assert.rejects(reportFeedback(input, root), /regular file without symlinks/)
  assert.equal(await readFile(target, 'utf8'), 'Original\n')
})

test('refuses existing report storage with permissive access', { skip: !process.getuid }, async (t) => {
  const { root, directory } = await fixture(t)
  await setFeedbackEnabled(true, root)
  await mkdir(directory, { mode: 0o700 })
  await chmod(directory, 0o755)
  await assert.rejects(reportFeedback(input, root), /owned and protected/)
  assert.deepEqual(await readdir(directory), [])
})

test('rejects a permissive enabled marker rather than granting consent', { skip: !process.getuid }, async (t) => {
  const { root, directory } = await fixture(t)
  await setFeedbackEnabled(true, root)
  const marker = join(dirname(directory), 'enabled')
  await chmod(marker, 0o666)
  await assert.rejects(feedbackEnabled(root), /owned and protected/)
  await assert.rejects(reportFeedback(input, root), /owned and protected/)
  assert.equal(await pathExists(directory), false)
  await setFeedbackEnabled(false, root)
  assert.equal(await feedbackEnabled(root), false)
})

test('independent CLI processes enable and deduplicate without Git or GitHub CLI', async (t) => {
  const { root, directory, run } = await cliFixture(t)
  const file = join(root, 'input.json')
  const json = JSON.stringify(input)
  await writeFile(file, json, { mode: 0o600 })
  assert.equal(await run(['status']), 'disabled')
  assert.deepEqual(await Promise.all([run(['enable']), run(['enable'])]), ['enabled', 'enabled'])
  assert.deepEqual(await readdir(dirname(directory)), ['enabled'])
  const reports = (await Promise.all([
    run(['report', '--input', file]), run(['report', '--input', '-'], json),
  ])).map(output => JSON.parse(output))
  assert.deepEqual(reports.map(report => report.status).sort(), ['existing', 'saved'])
  assert.equal(reports[0].path, reports[1].path)
  assert.equal((await readdir(directory)).length, 1)
  assert.equal(await run(['disable']), 'disabled')
  assert.equal(await run(['report', '--input', file]), '{"status":"disabled"}')
})
