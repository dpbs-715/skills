import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { type LinkResult } from './symlink.ts'
import { pathExists } from './utils.ts'

interface JsonArrayConfigOptions {
  file: string
  property: string
  values: readonly string[]
}

interface JsonObjectEntry {
  key: string
  value: string
}

interface JsonObjectConfigOptions {
  entries: readonly JsonObjectEntry[]
  file: string
  path: readonly string[]
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

function ensureNestedObject(config: JsonObject, path: readonly string[], file: string): JsonObject {
  let current = config

  for (const property of path) {
    const existing = current[property]

    if (existing === undefined) {
      const child: JsonObject = {}
      current[property] = child
      current = child
      continue
    }

    assertJsonObject(existing, file)
    current = existing
  }

  return current
}

/**
 * Ensure a JSON config object contains the configured key/value entries at a
 * nested object path. Existing unrelated keys at every level are preserved.
 */
export async function ensureJsonObjectEntries({
  entries,
  file,
  path,
}: JsonObjectConfigOptions): Promise<LinkResult[]> {
  if (path.length === 0)
    throw new Error(`Expected non-empty JSON object path for config file: ${file}`)

  const config = await readJsonObject(file)
  const target = ensureNestedObject(config, path, file)
  let changed = false

  for (const entry of entries) {
    if (target[entry.key] === entry.value)
      continue
    target[entry.key] = entry.value
    changed = true
  }

  const name = path.join('.')
  if (!changed)
    return [{ name, target: file, status: 'exists' }]

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`)

  return [{ name, target: file, status: 'updated' }]
}
