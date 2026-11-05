import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { validateSkillEvaluations } from '../lib/skillEvaluations.ts'
import { localSkillSources } from '../lib/config.ts'
import { repoRoot } from '../lib/utils.ts'

const temporaryPaths: string[] = []
const item = { id: 0, prompt: 'Preview the request.', expected_output: 'No remote writes.', files: [], assertions: ['No writes.'] }

async function suite(data: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'skill-evals-'))
  temporaryPaths.push(directory)
  await mkdir(join(directory, 'evals'))
  await writeFile(join(directory, 'evals', 'evals.json'), JSON.stringify(data))
  return directory
}

test('accepts valid evaluations and bundled input files', async () => {
  const directory = await suite({ skill_name: 'sample', evals: [{ ...item, files: ['input.txt'] }] })
  await writeFile(join(directory, 'input.txt'), 'input')
  assert.deepEqual(await validateSkillEvaluations(directory, 'sample'), [])
})

test('rejects mismatched names, duplicate IDs, incomplete cases, and invalid assertions', async () => {
  for (const data of [
    { skill_name: 'other', evals: [item] },
    { skill_name: 'sample', evals: [item, item] },
    { skill_name: 'sample', evals: [{ ...item, prompt: '' }] },
    { skill_name: 'sample', evals: [{ ...item, assertions: [true] }] },
    { skill_name: 'sample', evals: [{ ...item, files: ['missing.txt'] }] },
    { skill_name: 'sample', evals: [{ ...item, files: ['../outside.txt'] }] },
  ]) {
    const directory = await suite(data)
    assert.equal((await validateSkillEvaluations(directory, 'sample')).length, 1)
  }
})

test('rejects inputs that escape through a symlink and malformed trigger cases', async () => {
  const directory = await suite({ skill_name: 'sample', evals: [{ ...item, files: ['input.txt'] }] })
  await symlink(join(directory, 'evals', 'evals.json'), join(directory, 'input.txt'))
  assert.deepEqual(await validateSkillEvaluations(directory, 'sample'), [])
  await rm(join(directory, 'input.txt'))
  await symlink(join(repoRoot(), 'package.json'), join(directory, 'input.txt'))
  assert.match((await validateSkillEvaluations(directory, 'sample'))[0].message, /outside/)
  await writeFile(join(directory, 'evals', 'trigger-evals.json'), '[{"query":"Preview", "should_trigger":"yes"}]')
  assert.equal((await validateSkillEvaluations(directory, 'sample')).length, 2)
})

test('repository evaluation fixtures stay valid', async () => {
  for (const source of localSkillSources) {
    if (source.kind === 'directory')
      assert.deepEqual(await validateSkillEvaluations(join(repoRoot(), source.path), source.name), [], source.name)
  }
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
