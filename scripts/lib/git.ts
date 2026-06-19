import { readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { vendors as defaultVendors, type VendorSkillMeta } from '../../meta.ts'
import { execFileText, pathExists } from './utils.ts'

export type RunGit = (args: string[]) => Promise<string>

export interface Project {
  name: string
  path: string
  type: 'vendor'
  url: string
}

export interface ProjectOptions {
  vendors?: Record<string, VendorSkillMeta>
}

export function createGitRunner(root: string): RunGit {
  return args => execFileText('git', args, root)
}

/**
 * The vendor submodules declared in `meta.ts`, as uniform project records.
 */
export function getProjects({
  vendors = defaultVendors,
}: ProjectOptions = {}): Project[] {
  return Object.entries(vendors).map(([name, vendor]) => ({
    name,
    path: `vendor/${name}`,
    type: 'vendor' as const,
    url: vendor.source,
  }))
}

export function isManagedSubmodulePath(path: string): boolean {
  return path.startsWith('vendor/')
}

export async function readGitmodules(root: string): Promise<string> {
  const path = join(root, '.gitmodules')
  if (!await pathExists(path))
    return ''
  return await readFile(path, 'utf-8')
}

export async function restoreGitmodulesFromIndex(root: string, runGit: RunGit): Promise<void> {
  const path = join(root, '.gitmodules')
  if (await pathExists(path))
    return

  if (!await pathExists(join(root, '.git')))
    return

  const content = await optionalGitOutput(['show', ':.gitmodules'], runGit)
  if (content !== null)
    await writeFile(path, `${content}\n`)
}

export async function getExistingSubmodulePaths(root: string): Promise<string[]> {
  const content = await readGitmodules(root)
  return [...content.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)]
    .map(match => match[1].trim())
}

export async function submoduleExists(root: string, path: string): Promise<boolean> {
  const submodulePaths = await getExistingSubmodulePaths(root)
  return submodulePaths.includes(path)
}

export async function removeGitmodulesIfAllEntriesWereRemoved(root: string, removedPaths: string[]): Promise<void> {
  const existingPaths = await getExistingSubmodulePaths(root)
  const removed = new Set(removedPaths)
  const remainingPaths = existingPaths.filter(path => !removed.has(path))
  if (existingPaths.length > 0 && remainingPaths.length === 0)
    await rm(join(root, '.gitmodules'), { force: true })
}

export async function removeGitmodulesIfNoEntries(root: string): Promise<void> {
  const existingPaths = await getExistingSubmodulePaths(root)
  if (existingPaths.length === 0)
    await rm(join(root, '.gitmodules'), { force: true })
}

export async function isGitWorkTree(root: string, projectPath: string, runGit: RunGit): Promise<boolean> {
  try {
    const topLevel = await runGit(['-C', projectPath, 'rev-parse', '--show-toplevel'])
    return resolve(topLevel) === resolve(root, projectPath)
  }
  catch {
    return false
  }
}

export async function optionalGitOutput(args: string[], runGit: RunGit): Promise<string | null> {
  try {
    const output = await runGit(args)
    const trimmed = output.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  catch {
    return null
  }
}

export async function hasGitRef(projectPath: string, ref: string, runGit: RunGit): Promise<boolean> {
  return await optionalGitOutput(
    ['-C', projectPath, 'rev-parse', '--verify', '--quiet', ref],
    runGit,
  ) !== null
}

export async function isGitTrackedPath(path: string, runGit: RunGit): Promise<boolean> {
  return await optionalGitOutput(
    ['ls-files', '--error-unmatch', path],
    runGit,
  ) !== null
}

export async function resolveRemoteComparisonRef(projectPath: string, runGit: RunGit): Promise<string | null> {
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

export function parseBehindCount(output: string, projectPath: string): number {
  const trimmed = output.trim()
  if (!/^\d+$/.test(trimmed))
    throw new Error(`Unexpected git output for ${projectPath}: ${JSON.stringify(output)}`)

  return Number.parseInt(trimmed, 10)
}
