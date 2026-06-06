#!/usr/bin/env node

import { lstat, mkdir, readdir, readFile, readlink, realpath, symlink, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

import { pathExists, repoRoot as resolveRepoRoot } from './utils.ts'

export const DEFAULT_TARGETS = [
  '~/.codex/skills',
  '~/.claude/skills',
  '~/.agents/skills',
] as const

/**
 * Placeholder inside a `SKILL.template.md` that is replaced with this repo's
 * absolute path at link time, so a committed skill can reference files outside
 * its own directory without hardcoding one machine's checkout location.
 */
export const REPO_ROOT_TOKEN = '{{REPO_ROOT}}'

const SKILL_TEMPLATE_FILE = 'SKILL.template.md'
const SKILL_FILE = 'SKILL.md'

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
  return resolveRepoRoot(import.meta.url)
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path)
  }
  catch {
    return null
  }
}

/**
 * Whether `linkPath` is a symlink whose target lives directly inside the
 * repo's skills directory. Uses the raw link target rather than realpath so
 * that dangling links (whose source skill was deleted) are still recognised.
 */
async function pointsIntoSkills(linkPath: string, skillsDir: string): Promise<boolean> {
  let target: string
  try {
    target = await readlink(linkPath)
  }
  catch {
    return false
  }

  return dirname(resolve(dirname(linkPath), target)) === skillsDir
}

/**
 * Render every `SKILL.template.md` into a sibling `SKILL.md`, substituting the
 * repo root for {@link REPO_ROOT_TOKEN}. Runs before discovery/linking so a
 * fresh clone produces correct absolute paths on whatever machine ran `link`.
 * The generated `SKILL.md` is a build artifact and should be gitignored.
 */
export async function renderSkillTemplates(root = repoRoot()): Promise<string[]> {
  const skillsDir = join(root, 'skills')
  if (!await pathExists(skillsDir))
    return []

  const entries = await readdir(skillsDir, { withFileTypes: true })
  const rendered: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    const templatePath = join(skillsDir, entry.name, SKILL_TEMPLATE_FILE)
    if (!await pathExists(templatePath))
      continue

    const template = await readFile(templatePath, 'utf-8')
    const content = template.replaceAll(REPO_ROOT_TOKEN, root)
    await writeFile(join(skillsDir, entry.name, SKILL_FILE), content)
    rendered.push(entry.name)
  }

  return rendered.sort((left, right) => left.localeCompare(right))
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
    if (await pathExists(join(source, SKILL_FILE))) {
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
  await renderSkillTemplates(root)
  const skills = await discoverSkills(root)
  const skillsDir = join(root, 'skills')
  const current = new Set(skills.map(skill => skill.name))
  const results: LinkResult[] = []

  for (const target of targets) {
    await mkdir(target, { recursive: true })

    for (const skill of skills) {
      const status = await ensureLink(skill.source, join(target, skill.name))
      results.push({ name: skill.name, target, status })
    }

    // Prune stale links left behind by skills that no longer exist in the repo.
    const entries = await readdir(target, { withFileTypes: true })
    for (const entry of entries) {
      if (current.has(entry.name))
        continue

      const linkPath = join(target, entry.name)
      if (!await pointsIntoSkills(linkPath, skillsDir))
        continue

      await unlink(linkPath)
      results.push({ name: entry.name, target, status: 'removed' })
    }
  }

  return results
}

export async function removeSkillLinks({
  root = repoRoot(),
  targets = DEFAULT_TARGETS.map(homePath),
}: LinkOptions = {}): Promise<LinkResult[]> {
  const skillsDir = join(root, 'skills')
  const results: LinkResult[] = []

  for (const target of targets) {
    if (!await pathExists(target))
      continue

    // Scan the target directory so we also clean up dangling links whose
    // source skill was deleted from the repo, not just currently known skills.
    const entries = await readdir(target, { withFileTypes: true })
    for (const entry of entries) {
      const linkPath = join(target, entry.name)
      if (!await pointsIntoSkills(linkPath, skillsDir))
        continue

      await unlink(linkPath)
      results.push({ name: entry.name, target, status: 'removed' })
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
