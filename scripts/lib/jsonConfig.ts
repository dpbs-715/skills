import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { type LinkResult } from './symlink.ts'
import { pathExists } from './utils.ts'

interface JsonArrayConfigOptions {
  file: string
  property: string
  values: readonly string[]
}

type JsonObject = Record<string, unknown>

function assertJsonObject(parsed: unknown, file: string): asserts parsed is JsonObject {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`Expected JSON object in config file: ${file}`)
}

async function readJsonObject(file: string): Promise<JsonObject> {
  if (!await pathExists(file))
    return {}

  const content = await readFile(file, 'utf-8')
  if (content.trim() === '')
    return {}

  const parsed = JSON.parse(content) as unknown
  assertJsonObject(parsed, file)
  return parsed
}

/**
 * Ensure a JSON config array contains the configured values without disturbing
 * unrelated keys. Used for agents such as opencode that need rules referenced
 * from a config file before they are loaded.
 */
export async function ensureJsonArrayEntries({
  file,
  property,
  values,
}: JsonArrayConfigOptions): Promise<LinkResult[]> {
  const config = await readJsonObject(file)
  const existing = config[property]
  const entries: string[] = []

  if (existing !== undefined) {
    if (!Array.isArray(existing) || existing.some(entry => typeof entry !== 'string'))
      throw new Error(`Expected ${property} to be a string array in config file: ${file}`)

    entries.push(...existing)
  }

  let changed = false
  for (const value of values) {
    if (entries.includes(value))
      continue
    entries.push(value)
    changed = true
  }

  if (!changed)
    return [{ name: property, target: file, status: 'exists' }]

  config[property] = entries
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`)

  return [{ name: property, target: file, status: 'updated' }]
}
