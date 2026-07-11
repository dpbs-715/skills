import { readdir, readFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'

import {
  installableSkills as defaultInstallableSkills,
  localSkillSources as defaultLocalSkillSources,
  vendors as defaultVendors,
} from '../../meta.ts'
import { getProjects, type Project } from '../lib/git.ts'
import type { LocalSkillSource, VendorSkillMeta } from '../lib/metaTypes.ts'
import { discoverSkills } from '../lib/skillLinks.ts'
import { GENERATED_SKILLS_DIR } from '../lib/skillRendering.ts'
import { isDirectoryNonEmpty, pathExists, repoRoot } from '../lib/utils.ts'

export type SkillRole = 'local' | 'installable' | 'vendor'

export interface SkillStatus {
  estimatedTokens: number | null
  name: string
  present: boolean
  roles: SkillRole[]
}

export interface ProjectStatus {
  checkedOut: boolean
  name: string
  path: string
  type: Project['type']
}

export interface RepoStatus {
  extraSkills: string[]
  projects: ProjectStatus[]
  skills: SkillStatus[]
  tokenEstimate: TokenEstimate
}

export interface TokenEstimate {
  largest: Array<{ name: string, tokens: number }>
  total: number
}

interface StatusOptions {
  installableSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
  vendors?: Record<string, VendorSkillMeta>
}

const SKILL_ROLE_ORDER: SkillRole[] = ['local', 'installable', 'vendor']
const LARGEST_TOKEN_ESTIMATE_COUNT = 3
const COUNTED_SOURCE_DIRS = ['rules', 'skills']
const TEXT_FILE_EXTENSIONS = new Set([
  '',
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
])

function estimateTokens(content: string): number {
  let asciiChars = 0
  let nonAsciiChars = 0

  for (const char of content) {
    if (char.charCodeAt(0) <= 0x7F)
      asciiChars += 1
    else
      nonAsciiChars += 1
  }

  return Math.ceil(asciiChars / 4 + nonAsciiChars)
}

function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString('en-US')
}

function isRepoPath(root: string, path: string): boolean {
  const relPath = relative(root, path)
  return relPath === '' || (!relPath.startsWith('..') && !isAbsolute(relPath))
}

function isCountedSourcePath(root: string, path: string): boolean {
  const relPath = relative(root, path)
  return COUNTED_SOURCE_DIRS.some(dir => relPath === dir || relPath.startsWith(`${dir}/`))
}

function shouldCountFile(path: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(extname(path))
}

async function listCountableFiles(dir: string): Promise<string[]> {
  if (!await pathExists(dir))
    return []

  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...await listCountableFiles(path))
    else if (entry.isFile() && shouldCountFile(path))
      files.push(path)
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function markdownLinkTargets(content: string, sourcePath: string, root: string): string[] {
  const paths: string[] = []
  const markdownLinkPattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g
  const backtickPathPattern = /`([^`\n]+)`/g

  for (const match of content.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1].trim().split(/\s+/)[0]
    const target = rawTarget.replace(/^<|>$/g, '').split('#')[0]
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target))
      continue

    paths.push(resolve(join(sourcePath, '..'), target))
  }

  for (const match of content.matchAll(backtickPathPattern)) {
    const target = match[1].trim()
    if (isAbsolute(target))
      paths.push(target)
  }

  return paths
    .filter(path => isRepoPath(root, path) && isCountedSourcePath(root, path) && shouldCountFile(path))
    .sort((left, right) => left.localeCompare(right))
}

async function estimateReachableTokens(root: string, entryFiles: string[]): Promise<number> {
  const visited = new Set<string>()
  const queue = entryFiles.map(path => resolve(path))
  let tokens = 0

  while (queue.length > 0) {
    const path = queue.shift()
    if (!path || visited.has(path) || !isRepoPath(root, path) || !isCountedSourcePath(root, path))
      continue

    visited.add(path)
    const content = await readFile(path, 'utf-8')
    tokens += estimateTokens(content)

    for (const target of markdownLinkTargets(content, path, root)) {
      if (!visited.has(target))
        queue.push(target)
    }
  }

  return tokens
}

async function estimateSourceTokens(root: string, source: LocalSkillSource): Promise<number | null> {
  if (source.kind === 'directory') {
    const sourcePath = join(root, source.path)
    if (!isCountedSourcePath(root, sourcePath))
      return null

    const files = await listCountableFiles(sourcePath)
    return files.length === 0 ? null : await estimateReachableTokens(root, files)
  }

  const sourcePath = join(root, source.source)
  if (!isCountedSourcePath(root, sourcePath) || !await pathExists(sourcePath))
    return null

  return await estimateReachableTokens(root, [sourcePath])
}

/**
 * Read-only inventory of what `meta.ts` configures versus what is actually on
 * disk: which skills are expected (and why), whether each generated bundle is
 * present, estimated token size for tracked source content under skills/ and
 * rules/, any generated skill directories not declared in `meta.ts`, and the
 * checkout state of configured submodules. Drives `pnpm skills status`.
 */
export async function collectStatus({
  installableSkills = defaultInstallableSkills,
  localSkillSources = defaultLocalSkillSources,
  root = repoRoot(),
  vendors = defaultVendors,
}: StatusOptions = {}): Promise<RepoStatus> {
  const roles = new Map<string, Set<SkillRole>>()
  const addRole = (name: string, role: SkillRole): void => {
    const existing = roles.get(name) ?? new Set<SkillRole>()
    existing.add(role)
    roles.set(name, existing)
  }

  for (const source of localSkillSources)
    addRole(source.name, 'local')
  for (const name of installableSkills)
    addRole(name, 'installable')
  for (const vendor of Object.values(vendors)) {
    for (const outputSkill of Object.values(vendor.skills))
      addRole(outputSkill, 'vendor')
  }

  const discoveredSkills = await discoverSkills(root)
  const present = new Set(discoveredSkills.map(skill => skill.name))
  const tokenEstimates = new Map<string, number>()

  for (const source of localSkillSources) {
    const tokens = await estimateSourceTokens(root, source)
    if (tokens !== null)
      tokenEstimates.set(source.name, tokens)
  }

  const skills: SkillStatus[] = [...roles.entries()]
    .map(([name, set]) => ({
      estimatedTokens: tokenEstimates.get(name) ?? null,
      name,
      present: present.has(name),
      roles: SKILL_ROLE_ORDER.filter(role => set.has(role)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const extraSkills = [...present]
    .filter(name => !roles.has(name))
    .sort((left, right) => left.localeCompare(right))

  const projects: ProjectStatus[] = []
  for (const project of getProjects({ vendors })) {
    projects.push({
      checkedOut: await isDirectoryNonEmpty(join(root, project.path)),
      name: project.name,
      path: project.path,
      type: project.type,
    })
  }

  const largest = [...tokenEstimates.entries()]
    .map(([name, tokens]) => ({ name, tokens }))
    .sort((left, right) => right.tokens - left.tokens || left.name.localeCompare(right.name))
    .slice(0, LARGEST_TOKEN_ESTIMATE_COUNT)

  const tokenEstimate = {
    largest,
    total: [...tokenEstimates.values()].reduce((sum, tokens) => sum + tokens, 0),
  }

  return { extraSkills, projects, skills, tokenEstimate }
}

function printStatus(status: RepoStatus): void {
  console.log('Skills:')
  if (status.skills.length === 0) {
    console.log('  (none configured in meta.ts)')
  }
  else {
    for (const skill of status.skills) {
      const state = skill.present ? 'present' : 'MISSING'
      const tokens = skill.estimatedTokens === null ? '' : ` ~${formatTokenCount(skill.estimatedTokens)} tokens`
      console.log(`  ${skill.name} [${skill.roles.join(', ')}] ${state}${tokens}`)
    }
  }

  if (status.extraSkills.length > 0) {
    console.log(`\nUntracked generated skills (in ${GENERATED_SKILLS_DIR}/ but not declared in meta.ts):`)
    for (const name of status.extraSkills)
      console.log(`  ${name}`)
  }

  if (status.projects.length > 0) {
    console.log('\nSubmodules:')
    for (const project of status.projects) {
      const state = project.checkedOut ? 'checked out' : 'not initialized'
      console.log(`  ${project.path} (${project.type}) ${state}`)
    }
  }

  if (status.tokenEstimate.total > 0) {
    const largest = status.tokenEstimate.largest
      .map(skill => `${skill.name} ~${formatTokenCount(skill.tokens)}`)
      .join(', ')

    console.log('\nToken estimate:')
    console.log(`  skills/ and rules/ source content: ~${formatTokenCount(status.tokenEstimate.total)} tokens`)
    console.log(`  largest: ${largest}`)
  }
}

export async function run(): Promise<void> {
  printStatus(await collectStatus())
}
