import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { discoverWorkspaces, inspectProject, listWorkspaces, parseWorkspace, saveWorkspace } from '../lib/projectWorkspaces.ts'
import { integrationKind } from '../lib/integrationContracts.ts'
import { importProjectBinding, resolveProjectBinding, saveProjectBinding } from '../lib/projectBindings.ts'

async function bindingCommand(command: string, args: string[]) {
  const kind = integrationKind(args[0])
  const options: Record<string, string> = {}
  const allowed = command === 'binding'
    ? ['--cwd', '--workspace']
    : command === 'binding-save' ? ['--cwd', '--workspace', '--resource', '--input'] : ['--cwd', '--workspace', '--resource']
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!allowed.includes(key) || !value || value.startsWith('--') || Object.hasOwn(options, key))
      throw new Error('Invalid or duplicate binding option')
    options[key] = value
  }
  const cwd = options['--cwd'] ?? process.cwd()
  const selection = { workspace: options['--workspace'] }
  if (command === 'binding')
    return resolveProjectBinding(cwd, kind, selection)
  const resource = options['--resource']
  if (!resource)
    throw new Error('--resource is required')
  if (command === 'binding-import')
    return importProjectBinding(cwd, kind, resource, selection)
  if (!options['--input'])
    throw new Error('--input is required')
  let binding: unknown
  try { binding = JSON.parse(await readFile(options['--input'], 'utf8')) }
  catch { throw new Error('Binding input must be valid JSON (contents omitted)') }
  return saveProjectBinding(cwd, kind, resource, binding, selection)
}

export async function run(args: string[]): Promise<void> {
  const [command, ...rest] = args
  if (['binding', 'binding-save', 'binding-import'].includes(command)) {
    console.log(JSON.stringify(await bindingCommand(command, rest), null, 2))
    return
  }
  let cwd = process.cwd()
  let input: string | undefined
  let replace = false
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index]
    if (option === '--replace' && command === 'save') {
      replace = true
      continue
    }
    if ((option === '--cwd' && ['discover', 'inspect'].includes(command))
      || (option === '--input' && command === 'save')) {
      const value = rest[++index]
      if (!value || value.startsWith('--'))
        throw new Error(`${option} requires a value`)
      if (option === '--cwd')
        cwd = value
      else
        input = value
      continue
    }
    throw new Error(`Unknown argument for project ${command}: ${option}`)
  }

  let result: unknown
  if (command === 'list')
    result = await listWorkspaces()
  else if (command === 'discover')
    result = await discoverWorkspaces(cwd)
  else if (command === 'inspect')
    result = await inspectProject(cwd)
  else if (command === 'save' && input)
    result = await saveWorkspace(parseWorkspace(await readFile(input, 'utf8')), { replace })
  else
    throw new Error('Usage: project list | discover [--cwd <path>] | inspect [--cwd <path>] | save --input <yaml-or-json-file> [--replace] | binding <kind> [--cwd <path>] [--workspace <name>] | binding-save <kind> --resource <name> --input <json> | binding-import <kind> --resource <name>')

  console.log(JSON.stringify(result, null, 2))
}
