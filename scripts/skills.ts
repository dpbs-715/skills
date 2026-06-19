#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

import {
  linkedSkills as defaultLinkedSkills,
  sources as defaultSources,
  templateSkills as defaultTemplateSkills,
  vendors as defaultVendors,
  type VendorSkillMeta,
} from '../meta.ts'
import { discoverSkills } from './commands/link.ts'
import {
  printSyncResults,
  syncVendorSkills as defaultSyncVendorSkills,
  type SyncResult,
  type SyncVendorSkillsOptions,
} from './commands/sync-vendors.ts'
import { execFileText, pathExists, repoRoot } from './lib/utils.ts'

export type RunGit = (args: string[]) => Promise<string>

export interface Project {
  name: string
  path: string
  type: 'source' | 'vendor'
  url: string
}

export interface InitResult {
  name: string
  path: string
  status: 'added' | 'exists' | 'initialized' | 'repaired'
  type: Project['type']
}

export interface UpdateResult {
  behind: number
  name: string
  path: string
  type: Project['type']
}

export interface CleanupResult {
  skills: Array<{ name: string, status: 'removed' | 'would-remove' }>
  submodules: Array<{ path: string, status: 'removed' | 'would-remove' }>
}

export type SkillRole = 'template' | 'linked' | 'vendor'

export interface SkillStatus {
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
}

interface StatusOptions extends RootOptions {
  linkedSkills?: readonly string[]
  templateSkills?: readonly string[]
}

export interface ProjectOptions {
  sources?: Record<string, string>
  vendors?: Record<string, VendorSkillMeta>
}

interface RootOptions extends ProjectOptions {
  root?: string
}

interface GitOptions {
  runGit?: RunGit
}

interface SyncOptions extends GitOptions, RootOptions {
  syncVendorSkills?: (options: SyncVendorSkillsOptions) => Promise<SyncResult[]>
}

interface CleanupOptions extends GitOptions, RootOptions {
  linkedSkills?: readonly string[]
  templateSkills?: readonly string[]
  yes?: boolean
}

function createGitRunner(root: string): RunGit {
  return args => execFileText('git', args, root)
}

async function readGitmodules(root: string): Promise<string> {
  const path = join(root, '.gitmodules')
  if (!await pathExists(path))
    return ''
  return await readFile(path, 'utf-8')
}

async function restoreGitmodulesFromIndex(root: string, runGit: RunGit): Promise<void> {
  const path = join(root, '.gitmodules')
  if (await pathExists(path))
    return

  if (!await pathExists(join(root, '.git')))
    return

  const content = await optionalGitOutput(['show', ':.gitmodules'], runGit)
  if (content !== null)
    await writeFile(path, `${content}\n`)
}

async function getExistingSubmodulePaths(root: string): Promise<string[]> {
  const content = await readGitmodules(root)
  return [...content.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)]
    .map(match => match[1].trim())
}

async function submoduleExists(root: string, path: string): Promise<boolean> {
  const submodulePaths = await getExistingSubmodulePaths(root)
  return submodulePaths.includes(path)
}

async function removeGitmodulesIfAllEntriesWereRemoved(root: string, removedPaths: string[]): Promise<void> {
  const existingPaths = await getExistingSubmodulePaths(root)
  const removed = new Set(removedPaths)
  const remainingPaths = existingPaths.filter(path => !removed.has(path))
  if (existingPaths.length > 0 && remainingPaths.length === 0)
    await rm(join(root, '.gitmodules'), { force: true })
}

async function removeGitmodulesIfNoEntries(root: string): Promise<void> {
  const existingPaths = await getExistingSubmodulePaths(root)
  if (existingPaths.length === 0)
    await rm(join(root, '.gitmodules'), { force: true })
}

async function listDirectories(path: string): Promise<string[]> {
  if (!await pathExists(path))
    return []

  const entries = await readdir(path, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}

async function isDirectoryNonEmpty(path: string): Promise<boolean> {
  if (!await pathExists(path))
    return false

  const entries = await readdir(path)
  return entries.length > 0
}

async function isGitWorkTree(root: string, projectPath: string, runGit: RunGit): Promise<boolean> {
  try {
    const topLevel = await runGit(['-C', projectPath, 'rev-parse', '--show-toplevel'])
    return resolve(topLevel) === resolve(root, projectPath)
  }
  catch {
    return false
  }
}

async function optionalGitOutput(args: string[], runGit: RunGit): Promise<string | null> {
  try {
    const output = await runGit(args)
    const trimmed = output.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  catch {
    return null
  }
}

async function hasGitRef(projectPath: string, ref: string, runGit: RunGit): Promise<boolean> {
  return await optionalGitOutput(
    ['-C', projectPath, 'rev-parse', '--verify', '--quiet', ref],
    runGit,
  ) !== null
}

async function isGitTrackedPath(path: string, runGit: RunGit): Promise<boolean> {
  return await optionalGitOutput(
    ['ls-files', '--error-unmatch', path],
    runGit,
  ) !== null
}

async function resolveRemoteComparisonRef(projectPath: string, runGit: RunGit): Promise<string | null> {
  const configuredBranch = await optionalGitOutput(
    ['config', '-f', '.gitmodules', '--get', `submodule.${projectPath}.branch`],
    runGit,
  )
  if (configuredBranch)
    return `origin/${configuredBranch}`

  const originHead = await optionalGitOutput(
    ['-C', projectPath, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    runGit,
  )
  if (originHead)
    return originHead

  for (const ref of ['origin/main', 'origin/master']) {
    if (await hasGitRef(projectPath, ref, runGit))
      return ref
  }

  return null
}

function parseBehindCount(output: string, projectPath: string): number {
  const trimmed = output.trim()
  if (!/^\d+$/.test(trimmed))
    throw new Error(`Unexpected git output for ${projectPath}: ${JSON.stringify(output)}`)

  return Number.parseInt(trimmed, 10)
}

function isManagedSubmodulePath(path: string): boolean {
  return path.startsWith('sources/') || path.startsWith('vendor/')
}

export function getProjects({
  sources = defaultSources,
  vendors = defaultVendors,
}: ProjectOptions = {}): Project[] {
  return [
    ...Object.entries(sources).map(([name, url]) => ({
      name,
      path: `sources/${name}`,
      type: 'source' as const,
      url,
    })),
    ...Object.entries(vendors).map(([name, vendor]) => ({
      name,
      path: `vendor/${name}`,
      type: 'vendor' as const,
      url: vendor.source,
    })),
  ]
}

export async function initSubmodules({
  root = repoRoot(),
  runGit = createGitRunner(root),
  sources = defaultSources,
  vendors = defaultVendors,
}: RootOptions & GitOptions = {}): Promise<InitResult[]> {
  const results: InitResult[] = []
  await restoreGitmodulesFromIndex(root, runGit)

  for (const project of getProjects({ sources, vendors })) {
    if (await submoduleExists(root, project.path)) {
      if (!await isGitTrackedPath(project.path, runGit)) {
        await runGit(['config', '-f', '.gitmodules', '--remove-section', `submodule.${project.path}`])
        await runGit(['submodule', 'add', '--force', project.url, project.path])
        results.push({
          name: project.name,
          path: project.path,
          status: 'repaired',
          type: project.type,
        })
        continue
      }

      if (!await isGitWorkTree(root, project.path, runGit)) {
        await runGit(['submodule', 'update', '--init', project.path])
        results.push({
          name: project.name,
          path: project.path,
          status: 'initialized',
          type: project.type,
        })
        continue
      }

      results.push({
        name: project.name,
        path: project.path,
        status: 'exists',
        type: project.type,
      })
      continue
    }

    await mkdir(join(root, dirname(project.path)), { recursive: true })
    await runGit(['submodule', 'add', project.url, project.path])
    results.push({
      name: project.name,
      path: project.path,
      status: 'added',
      type: project.type,
    })
  }

  return results
}

export async function syncSubmodules({
  root = repoRoot(),
  runGit = createGitRunner(root),
  syncVendorSkills = defaultSyncVendorSkills,
  vendors = defaultVendors,
}: SyncOptions = {}): Promise<SyncResult[]> {
  await runGit(['submodule', 'update', '--init', '--remote', '--merge'])
  return await syncVendorSkills({ root, vendors })
}

export async function checkUpdates({
  root = repoRoot(),
  runGit = createGitRunner(root),
  sources = defaultSources,
  vendors = defaultVendors,
}: RootOptions & GitOptions = {}): Promise<UpdateResult[]> {
  const updates: UpdateResult[] = []

  for (const project of getProjects({ sources, vendors })) {
    if (!await pathExists(join(root, project.path)))
      continue

    if (!await isGitWorkTree(root, project.path, runGit))
      continue

    await runGit(['-C', project.path, 'fetch'])
    const remoteRef = await resolveRemoteComparisonRef(project.path, runGit)
    if (!remoteRef)
      continue

    const behindText = await runGit(['-C', project.path, 'rev-list', `HEAD..${remoteRef}`, '--count'])
    const behind = parseBehindCount(behindText, project.path)
    if (behind > 0) {
      updates.push({
        behind,
        name: project.name,
        path: project.path,
        type: project.type,
      })
    }
  }

  return updates
}

function expectedSkillNames({
  linkedSkills = defaultLinkedSkills,
  sources = defaultSources,
  templateSkills = defaultTemplateSkills,
  vendors = defaultVendors,
}: {
  linkedSkills?: readonly string[]
  sources?: Record<string, string>
  templateSkills?: readonly string[]
  vendors?: Record<string, VendorSkillMeta>
}): Set<string> {
  const expected = new Set<string>([
    ...templateSkills,
    ...linkedSkills,
  ])

  for (const name of Object.keys(sources))
    expected.add(name)

  for (const vendor of Object.values(vendors)) {
    for (const outputSkill of Object.values(vendor.skills))
      expected.add(outputSkill)
  }

  return expected
}

export async function cleanupUnusedEntries({
  linkedSkills = defaultLinkedSkills,
  root = repoRoot(),
  runGit = createGitRunner(root),
  sources = defaultSources,
  templateSkills = defaultTemplateSkills,
  vendors = defaultVendors,
  yes = false,
}: CleanupOptions = {}): Promise<CleanupResult> {
  const projects = getProjects({ sources, vendors })
  const expectedSubmodulePaths = new Set(projects.map(project => project.path))
  const existingSubmodulePaths = await getExistingSubmodulePaths(root)
  const extraSubmodules = existingSubmodulePaths.filter(path =>
    isManagedSubmodulePath(path) && !expectedSubmodulePaths.has(path),
  )

  const expectedSkills = expectedSkillNames({ linkedSkills, sources, templateSkills, vendors })
  const existingSkills = await listDirectories(join(root, 'skills'))
  const extraSkills = existingSkills.filter(name => !expectedSkills.has(name))

  const results: CleanupResult = {
    skills: [],
    submodules: [],
  }

  for (const path of extraSubmodules) {
    if (yes) {
      const isTracked = await isGitTrackedPath(path, runGit)
      if (isTracked)
        await runGit(['submodule', 'deinit', '-f', path])

      await rm(join(root, '.git', 'modules', path), { recursive: true, force: true })
      if (isTracked)
        await runGit(['rm', '-f', path])
      else {
        await runGit(['config', '-f', '.gitmodules', '--remove-section', `submodule.${path}`])
        await rm(join(root, path), { recursive: true, force: true })
      }
      results.submodules.push({ path, status: 'removed' })
    }
    else {
      results.submodules.push({ path, status: 'would-remove' })
    }
  }

  if (yes)
    await removeGitmodulesIfAllEntriesWereRemoved(root, extraSubmodules)

  for (const name of extraSkills) {
    if (yes) {
      await rm(join(root, 'skills', name), { recursive: true, force: true })
      results.skills.push({ name, status: 'removed' })
    }
    else {
      results.skills.push({ name, status: 'would-remove' })
    }
  }

  if (yes)
    await removeGitmodulesIfNoEntries(root)

  return results
}

const SKILL_ROLE_ORDER: SkillRole[] = ['template', 'linked', 'vendor']

/**
 * Read-only inventory of what `meta.ts` configures versus what is actually on
 * disk: which skills are expected (and why), whether each one is present in
 * `skills/`, any skill directories not declared in `meta.ts`, and the checkout
 * state of configured submodules. Drives `pnpm skills status`.
 */
export async function collectStatus({
  linkedSkills = defaultLinkedSkills,
  root = repoRoot(),
  sources = defaultSources,
  templateSkills = defaultTemplateSkills,
  vendors = defaultVendors,
}: StatusOptions = {}): Promise<RepoStatus> {
  const roles = new Map<string, Set<SkillRole>>()
  const addRole = (name: string, role: SkillRole): void => {
    const existing = roles.get(name) ?? new Set<SkillRole>()
    existing.add(role)
    roles.set(name, existing)
  }

  for (const name of templateSkills)
    addRole(name, 'template')
  for (const name of linkedSkills)
    addRole(name, 'linked')
  for (const vendor of Object.values(vendors)) {
    for (const outputSkill of Object.values(vendor.skills))
      addRole(outputSkill, 'vendor')
  }

  const present = new Set((await discoverSkills(root)).map(skill => skill.name))

  const skills: SkillStatus[] = [...roles.entries()]
    .map(([name, set]) => ({
      name,
      present: present.has(name),
      roles: SKILL_ROLE_ORDER.filter(role => set.has(role)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const extraSkills = [...present]
    .filter(name => !roles.has(name))
    .sort((left, right) => left.localeCompare(right))

  const projects: ProjectStatus[] = []
  for (const project of getProjects({ sources, vendors })) {
    projects.push({
      checkedOut: await isDirectoryNonEmpty(join(root, project.path)),
      name: project.name,
      path: project.path,
      type: project.type,
    })
  }

  return { extraSkills, projects, skills }
}

function hasYes(args: string[]): boolean {
  return args.includes('--yes') || args.includes('-y')
}

function printInitResults(results: InitResult[]): void {
  if (results.length === 0) {
    console.log('No submodules configured.')
    return
  }

  for (const result of results)
    console.log(`${result.status}: ${result.path}`)
}

function printUpdates(updates: UpdateResult[]): void {
  if (updates.length === 0) {
    console.log('All submodules are up to date.')
    return
  }

  for (const update of updates)
    console.log(`${update.path}: ${update.behind} commit(s) behind`)
}

function printCleanupResults(results: CleanupResult, yes: boolean): void {
  if (results.skills.length === 0 && results.submodules.length === 0) {
    console.log('Nothing to clean.')
    return
  }

  for (const result of results.submodules)
    console.log(`${result.status}: ${result.path}`)
  for (const result of results.skills)
    console.log(`${result.status}: skills/${result.name}`)

  if (!yes)
    console.log('Run with --yes to remove these entries.')
}

function printStatus(status: RepoStatus): void {
  console.log('Skills:')
  if (status.skills.length === 0) {
    console.log('  (none configured in meta.ts)')
  }
  else {
    for (const skill of status.skills) {
      const state = skill.present ? 'present' : 'MISSING'
      console.log(`  ${skill.name} [${skill.roles.join(', ')}] ${state}`)
    }
  }

  if (status.extraSkills.length > 0) {
    console.log('\nUntracked skills (in skills/ but not declared in meta.ts):')
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
}

function printHelp(): void {
  console.log(`Usage: pnpm skills <command>

Commands:
  status     Show configured skills, their roles, and submodule state
  init       Add missing source/vendor git submodules from meta.ts
  sync       Update submodules, then sync vendored skills into skills/
  check      Fetch submodules and report upstream updates
  cleanup    Report unused submodules and skills; pass --yes to remove
`)
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const command = args.find(arg => !arg.startsWith('-'))

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'status') {
    printStatus(await collectStatus())
    return
  }

  if (command === 'init') {
    printInitResults(await initSubmodules())
    return
  }

  if (command === 'sync') {
    const results = await syncSubmodules()
    printSyncResults(results)
    if (results.some(result => result.status !== 'synced'))
      process.exitCode = 1
    return
  }

  if (command === 'check') {
    printUpdates(await checkUpdates())
    return
  }

  if (command === 'cleanup') {
    const yes = hasYes(args)
    printCleanupResults(await cleanupUnusedEntries({ yes }), yes)
    return
  }

  console.error(`Unknown command: ${command}`)
  printHelp()
  process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
