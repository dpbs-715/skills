import process from 'node:process'

import { type ValidationOptions, type ValidationResult, validateSkills } from '../lib/validation.ts'

function printValidationResult(result: ValidationResult): void {
  if (result.ok) {
    console.log('Validation passed.')
    return
  }

  for (const issue of result.issues)
    console.log(`${issue.path}: ${issue.message}`)

  process.exitCode = 1
}

export async function run(args: string[] = [], options: ValidationOptions = {}): Promise<void> {
  if (args.length > 0)
    throw new Error(`Unknown argument: ${args[0]}`)

  printValidationResult(await validateSkills(options))
}
