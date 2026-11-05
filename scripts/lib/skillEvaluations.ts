import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'

import { isRepoPath } from './markdownReferences.ts'
import { pathExists } from './utils.ts'

interface EvaluationIssue {
  path: string
  message: string
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim()
}

/** Validate portable evaluation inputs. This does not run a model or grade behavior. */
export async function validateSkillEvaluations(directory: string, name: string): Promise<EvaluationIssue[]> {
  const issues: EvaluationIssue[] = []
  for (const file of ['evals.json', 'trigger-evals.json']) {
    const path = join(directory, 'evals', file)
    if (!await pathExists(path))
      continue
    try {
      const data: unknown = JSON.parse(await readFile(path, 'utf8'))
      if (file === 'trigger-evals.json') {
        if (!Array.isArray(data) || data.length === 0)
          throw new Error('Trigger evaluations must be a non-empty array.')
        for (const item of data) {
          if (!object(item) || !text(item.query) || typeof item.should_trigger !== 'boolean')
            throw new Error('Each trigger evaluation needs a query and boolean should_trigger.')
        }
        continue
      }
      if (!object(data) || data.skill_name !== name || !Array.isArray(data.evals) || data.evals.length === 0)
        throw new Error('Evaluation suite needs the matching skill_name and a non-empty evals array.')
      const ids = new Set<number>()
      for (const item of data.evals) {
        if (!object(item) || !Number.isSafeInteger(item.id) || (item.id as number) < 0 || ids.has(item.id as number))
          throw new Error('Evaluation IDs must be unique nonnegative integers.')
        ids.add(item.id as number)
        if (!text(item.prompt) || !text(item.expected_output) || !Array.isArray(item.files))
          throw new Error(`Evaluation ${item.id} needs prompt, expected_output, and files.`)
        if (item.assertions !== undefined && (!Array.isArray(item.assertions) || !item.assertions.length || !item.assertions.every(text)))
          throw new Error(`Evaluation ${item.id} assertions must be a non-empty string array when provided.`)
        for (const input of item.files) {
          if (!text(input) || isAbsolute(input) || !isRepoPath(directory, resolve(directory, input)))
            throw new Error(`Evaluation ${item.id} inputs must be relative paths within the skill bundle.`)
          const target = resolve(directory, input)
          if (!await pathExists(target) || !(await stat(target)).isFile())
            throw new Error(`Evaluation ${item.id} input file is missing: ${input}`)
          if (!isRepoPath(await realpath(directory), await realpath(target)))
            throw new Error(`Evaluation ${item.id} input resolves outside the skill bundle: ${input}`)
        }
      }
    }
    catch (error) {
      issues.push({ path, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return issues
}
