import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import { cleanupUnusedEntries } from '../commands/cleanup.ts'

const exec = promisify(execFile)
const temporaryPaths: string[] = []
const git = async (cwd: string, ...args: string[]): Promise<string> => (await exec('git', ['-C', cwd, ...args])).stdout.trim()

async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'skills-cleanup-'))
  temporaryPaths.push(directory)
  const upstream = join(directory, 'upstream')
  const root = join(directory, 'repo')
  for (const path of [upstream, root]) {
    await mkdir(path)
    await git(path, 'init', '-q')
    await git(path, 'config', 'user.name', 'Cleanup Test')
    await git(path, 'config', 'user.email', 'test@example.invalid')
  }
  await writeFile(join(upstream, 'SKILL.md'), 'Original skill\n')
  await git(upstream, 'add', '.')
  await git(upstream, 'commit', '-qm', 'fixture')
  await git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'vendor/old')
  await git(root, 'commit', '-qm', 'fixture')
  return root
}

const cleanup = (root: string, yes = true) => cleanupUnusedEntries({ root, yes, vendors: {}, installableSkills: [], localSkillSources: [] })

for (const kind of ['tracked', 'untracked', 'ignored'] as const) {
  test(`cleanup preserves ${kind} local work and its registration`, async () => {
    const root = await fixture()
    const path = kind === 'tracked' ? 'SKILL.md' : 'draft.md'
    if (kind === 'ignored')
      await writeFile(join(root, '.git', 'modules', 'vendor', 'old', 'info', 'exclude'), 'draft.md\n')
    await writeFile(join(root, 'vendor', 'old', path), 'Local work\n')
    const registration = await readFile(join(root, '.gitmodules'), 'utf8')
    for (const yes of [false, true]) {
      const result = await cleanup(root, yes)
      assert.equal(result.submodules[0].status, 'skipped')
      assert.equal(await readFile(join(root, 'vendor', 'old', path), 'utf8'), 'Local work\n')
      assert.equal(await readFile(join(root, '.gitmodules'), 'utf8'), registration)
    }
  })
}

test('cleanup preserves local commits even in a clean submodule', async () => {
  const root = await fixture()
  const child = join(root, 'vendor', 'old')
  await writeFile(join(child, 'SKILL.md'), 'Committed local work\n')
  await git(child, '-c', 'user.name=Cleanup Test', '-c', 'user.email=test@example.invalid', 'commit', '-qam', 'local work')
  const head = await git(child, 'rev-parse', 'HEAD')
  const result = await cleanup(root)
  assert.equal(result.submodules[0].status, 'skipped')
  assert.equal(await git(child, 'rev-parse', 'HEAD'), head)
})

test('cleanup removes a clean published checkout and retains its Git database', async () => {
  const root = await fixture()
  const child = join(root, 'vendor', 'old')
  const head = await git(child, 'rev-parse', 'HEAD')
  const result = await cleanup(root)
  assert.deepEqual(result.submodules, [{ path: 'vendor/old', status: 'removed' }])
  await assert.rejects(readFile(join(child, 'SKILL.md')), /ENOENT/)
  await assert.rejects(readFile(join(root, '.gitmodules')), /ENOENT/)
  assert.equal(await git(root, '--git-dir', join(root, '.git', 'modules', 'vendor', 'old'), 'rev-parse', 'HEAD'), head)
})

test('cleanup refuses nonempty directories that are not initialized submodules', async () => {
  const root = await fixture()
  await git(root, 'submodule', 'deinit', '--', 'vendor/old')
  await writeFile(join(root, 'vendor', 'old', 'draft.md'), 'Local work\n')
  const result = await cleanup(root)
  assert.equal(result.submodules[0].status, 'skipped')
  assert.equal(await readFile(join(root, 'vendor', 'old', 'draft.md'), 'utf8'), 'Local work\n')
})

test('cleanup preserves an embedded Git database even when all refs are published', async () => {
  const root = await fixture()
  await git(root, 'submodule', 'deinit', '--', 'vendor/old')
  await git(root, 'rm', '--', 'vendor/old')
  const child = join(root, 'vendor', 'old')
  await git(root, 'clone', '-q', join(root, '..', 'upstream'), child)
  await writeFile(join(root, '.gitmodules'), '[submodule "vendor/old"]\n\tpath = vendor/old\n\turl = unused\n')
  const head = await git(child, 'rev-parse', 'HEAD')
  const result = await cleanup(root)
  assert.equal(result.submodules[0].status, 'skipped')
  assert.equal(await git(child, 'rev-parse', 'HEAD'), head)
  assert.match(await readFile(join(root, '.gitmodules'), 'utf8'), /vendor\/old/)
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
