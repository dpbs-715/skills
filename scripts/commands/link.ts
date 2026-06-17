#!/usr/bin/env node

import { lstat, mkdir, readdir, readFile, readlink, realpath, symlink, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

import {
  linkedSkills as defaultLinkedSkills,
  templateSkills as defaultTemplateSkills,
} from '../../meta.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

export const DEFAULT_TARGETS = [
  '~/.codex/skills',
  '~/.claude/skills',
  '~/.agents/skills',
] as const

/**
 * Placeholder inside a skill template (`templates/<name>/SKILL.md`) that is
 * replaced with this repo's absolute path at link time, so a skill can
 * reference files outside its own directory without hardcoding one machine's
 * checkout location.
 */
export const REPO_ROOT_TOKEN = '{{REPO_ROOT}}'

const TEMPLATES_DIR = 'templates'
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
  linkedSkills?: readonly string[]
  root?: string
  targets?: string[]
  templateSkills?: readonly string[]
}

interface TemplateOptions {
  root?: string
  templateSkills?: readonly string[]
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
 * Render each `templates/<name>/SKILL.md` into `skills/<name>/SKILL.md`,
 * substituting the repo root for {@link REPO_ROOT_TOKEN}. Templates live
 * outside `skills/` so they never ride along into the symlinked skill bundle;
 * only the generated `SKILL.md` is linked. Runs before discovery/linking so a
 * fresh clone produces correct absolute paths on whatever machine ran `link`.
 * The generated skill directory is a build artifact and should be gitignored.
 */
export async function renderSkillTemplates({
  root = repoRoot(),
  templateSkills = defaultTemplateSkills,
}: TemplateOptions = {}): Promise<string[]> {
  const templatesDir = join(root, TEMPLATES_DIR)
  if (templateSkills.length === 0)
    return []
  if (!await pathExists(templatesDir))
    throw new Error(`Missing configured skill template: templates/${templateSkills[0]}/${SKILL_FILE}`)

  const entries = await readdir(templatesDir, { withFileTypes: true })
  const available = new Set(entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name))
  const rendered: string[] = []

  for (const name of templateSkills) {
    const templatePath = join(templatesDir, name, SKILL_FILE)
    if (!available.has(name) || !await pathExists(templatePath))
      throw new Error(`Missing configured skill template: templates/${name}/${SKILL_FILE}`)

    const template = await readFile(templatePath, 'utf-8')
    const content = template.replaceAll(REPO_ROOT_TOKEN, root)
    const skillDir = join(root, 'skills', name)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, SKILL_FILE), content)
    rendered.push(name)
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

async function discoverLinkedSkills(root: string, linkedSkills: readonly string[]): Promise<Skill[]> {
  const skills = await discoverSkills(root)
  const byName = new Map(skills.map(skill => [skill.name, skill]))

  return linkedSkills
    .map((name) => {
      const skill = byName.get(name)
      if (!skill)
        throw new Error(`Missing configured linked skill: skills/${name}/${SKILL_FILE}`)
      return skill
    })
    .sort((left, right) => left.name.localeCompare(right.name))
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

async function existingDefaultTargets(): Promise<string[]> {
  const targets: string[] = []

  for (const target of DEFAULT_TARGETS.map(homePath)) {
    if (await pathExists(target))
      targets.push(target)
  }

  return targets
}

export async function createSkillLinks({
  linkedSkills = defaultLinkedSkills,
  root = repoRoot(),
  targets,
  templateSkills = defaultTemplateSkills,
}: LinkOptions = {}): Promise<LinkResult[]> {
  await renderSkillTemplates({ root, templateSkills })
  const skills = await discoverLinkedSkills(root, linkedSkills)
  const skillsDir = join(root, 'skills')
  const current = new Set(skills.map(skill => skill.name))
  const results: LinkResult[] = []
  const linkTargets = targets ?? await existingDefaultTargets()
  const createMissingTargets = targets !== undefined

  for (const target of linkTargets) {
    if (createMissingTargets)
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
  const results = options.action === 'unlink'
    ? await removeSkillLinks({ targets: options.targets.length > 0 ? options.targets : undefined })
    : await createSkillLinks({ targets: options.targets.length > 0 ? options.targets : undefined })

  printResults(results)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
