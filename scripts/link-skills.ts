#!/usr/bin/env node

import { lstat, mkdir, readdir, realpath, symlink, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export const DEFAULT_TARGETS = [
  '~/.codex/skills',
  '~/.claude/skills',
  '~/.agents/skills',
] as const

type LinkAction = 'link' | 'unlink'
type LinkStatus = 'exists' | 'linked' | 'removed'

interface Skill {
  name: string
  source: string
}

interface LinkResult {
  name: string
  target: string
  status: LinkStatus
}

interface LinkOptions {
  root?: string
  targets?: string[]
}

interface CliOptions {
  action: LinkAction
  targets: string[]
}

function homePath(path: string): string {
  const home = process.env.HOME
  if (!home)
    throw new Error('HOME is not set')

  if (path === '~')
    return home
  if (path.startsWith('~/'))
    return join(home, path.slice(2))
  return path
}

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return false
    throw error
  }
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path)
  }
  catch {
    return null
  }
}

export async function discoverSkills(root = repoRoot()): Promise<Skill[]> {
  const skillsDir = join(root, 'skills')
  if (!await pathExists(skillsDir))
    return []

  const entries = await readdir(skillsDir, { withFileTypes: true })
  const skills: Skill[] = []

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    const source = join(skillsDir, entry.name)
    if (await pathExists(join(source, 'SKILL.md'))) {
      skills.push({ name: entry.name, source })
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name))
}

async function ensureLink(source: string, linkPath: string): Promise<'exists' | 'linked'> {
  if (!await pathExists(linkPath)) {
    await symlink(source, linkPath)
    return 'linked'
  }

  const stat = await lstat(linkPath)
  if (!stat.isSymbolicLink()) {
    throw new Error(`Refusing to replace non-symlink: ${linkPath}`)
  }

  const existing = await safeRealpath(linkPath)
  const expected = await realpath(source)
  if (existing === expected)
    return 'exists'

  throw new Error(`Refusing to replace symlink with different target: ${linkPath}`)
}

export async function createSkillLinks({
  root = repoRoot(),
  targets = DEFAULT_TARGETS.map(homePath),
}: LinkOptions = {}): Promise<LinkResult[]> {
  const skills = await discoverSkills(root)
  const results: LinkResult[] = []

  for (const target of targets) {
    await mkdir(target, { recursive: true })

    for (const skill of skills) {
      const status = await ensureLink(skill.source, join(target, skill.name))
      results.push({ name: skill.name, target, status })
    }
  }

  return results
}

export async function removeSkillLinks({
  root = repoRoot(),
  targets = DEFAULT_TARGETS.map(homePath),
}: LinkOptions = {}): Promise<LinkResult[]> {
  const skills = await discoverSkills(root)
  const results: LinkResult[] = []

  for (const target of targets) {
    if (!await pathExists(target))
      continue

    for (const skill of skills) {
      const linkPath = join(target, skill.name)
      if (!await pathExists(linkPath))
        continue

      const stat = await lstat(linkPath)
      if (!stat.isSymbolicLink())
        continue

      const existing = await safeRealpath(linkPath)
      const expected = await realpath(skill.source)
      if (existing !== expected)
        continue

      await unlink(linkPath)
      results.push({ name: skill.name, target, status: 'removed' })
    }
  }

  return results
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    action: 'link',
    targets: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === 'link' || arg === 'unlink') {
      options.action = arg
      continue
    }

    if (arg === '--target') {
      const value = args[index + 1]
      if (!value)
        throw new Error('--target requires a path')
      options.targets.push(homePath(value))
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printResults(results: LinkResult[]): void {
  if (results.length === 0) {
    console.log('No skill links changed.')
    return
  }

  for (const result of results) {
    console.log(`${result.status}: ${result.target}/${result.name}`)
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const targets = options.targets.length > 0 ? options.targets : DEFAULT_TARGETS.map(homePath)
  const results = options.action === 'unlink'
    ? await removeSkillLinks({ targets })
    : await createSkillLinks({ targets })

  printResults(results)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
