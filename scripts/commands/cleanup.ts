import { lstat, realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import {
  installableSkills as defaultInstallableSkills,
  localSkillSources as defaultLocalSkillSources,
  vendors as defaultVendors,
} from '../lib/config.ts'
import {
  createGitRunner,
  getExistingSubmodulePaths,
  getProjects,
  isGitTrackedPath,
  isGitWorkTree,
  isManagedSubmodulePath,
  removeGitmodulesIfAllEntriesWereRemoved,
  removeGitmodulesIfNoEntries,
  type RunGit,
} from '../lib/git.ts'
import type { LocalSkillSource, VendorSkillMeta } from '../lib/metaTypes.ts'
import { GENERATED_AGENTS_DIR } from '../lib/agents.ts'
import { GENERATED_SKILLS_DIR } from '../lib/skillRendering.ts'
import { isRepoPath } from '../lib/markdownReferences.ts'
import { isDirectoryNonEmpty, listDirectories, pathExists, repoRoot } from '../lib/utils.ts'

export interface CleanupResult {
  skills: Array<{ name: string, status: 'removed' | 'would-remove' }>
  submodules: Array<{ path: string, status: 'removed' | 'would-remove' } | { path: string, status: 'skipped', reason: string }>
}

interface CleanupOptions {
  installableSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
  runGit?: RunGit
  vendors?: Record<string, VendorSkillMeta>
  yes?: boolean
}

function expectedSkillNames({
  installableSkills = defaultInstallableSkills,
  localSkillSources = defaultLocalSkillSources,
  vendors = defaultVendors,
}: {
  installableSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  vendors?: Record<string, VendorSkillMeta>
}): Set<string> {
  const expected = new Set<string>([
    ...localSkillSources.map(source => source.name),
    ...installableSkills,
  ])

  for (const vendor of Object.values(vendors)) {
    for (const outputSkill of Object.values(vendor.skills))
      expected.add(outputSkill)
  }

  return expected
}

async function removalBlocker(root: string, path: string, runGit: RunGit): Promise<string | undefined> {
  const directory = join(root, path)
  try {
    if (!await pathExists(directory))
      return
    if ((await lstat(directory)).isSymbolicLink())
      return 'Submodule path is a symlink; inspect it manually.'
    if (!await isDirectoryNonEmpty(directory))
      return
    if (!await isGitWorkTree(await realpath(root), path, runGit))
      return 'Nonempty directory is not an initialized submodule; inspect it manually.'
    const gitDirectory = await runGit(['-C', path, 'rev-parse', '--absolute-git-dir'])
    if (isRepoPath(await realpath(directory), await realpath(gitDirectory.trim())))
      return 'Git database is inside the checkout; preserve it outside the directory before removal.'
    const changes = await runGit(['-C', path, 'status', '--porcelain', '--untracked-files=all', '--ignored', '--ignore-submodules=none'])
    if (changes.trim())
      return 'Local changes or untracked files must be saved before removal.'
    const localCommits = await runGit(['-C', path, 'rev-list', '--all', '--not', '--remotes'])
    if (localCommits.trim())
      return 'Commits are not reachable from known remote refs; publish or preserve them before removal.'
  }
  catch {
    return 'Could not inspect local work; inspect the submodule manually.'
  }
}

export async function cleanupUnusedEntries({
  installableSkills = defaultInstallableSkills,
  localSkillSources = defaultLocalSkillSources,
  root = repoRoot(),
  runGit = createGitRunner(root),
  vendors = defaultVendors,
  yes = false,
}: CleanupOptions = {}): Promise<CleanupResult> {
  const projects = getProjects({ vendors })
  const expectedSubmodulePaths = new Set(projects.map(project => project.path))
  const existingSubmodulePaths = await getExistingSubmodulePaths(root)
  const extraSubmodules = existingSubmodulePaths.filter(path =>
    isManagedSubmodulePath(path) && !expectedSubmodulePaths.has(path),
  )

  const expectedSkills = expectedSkillNames({ installableSkills, localSkillSources, vendors })
  const existingSkills = await listDirectories(join(root, GENERATED_SKILLS_DIR))
  // Role outputs share generated/ with skill bundles and are managed by the agent renderer.
  const extraSkills = existingSkills.filter(name =>
    join(GENERATED_SKILLS_DIR, name) !== GENERATED_AGENTS_DIR && !expectedSkills.has(name),
  )

  const results: CleanupResult = {
    skills: [],
    submodules: [],
  }

  for (const path of extraSubmodules) {
    const reason = await removalBlocker(root, path, runGit)
    if (reason) {
      results.submodules.push({ path, status: 'skipped', reason })
      continue
    }
    if (yes) {
      const isTracked = await isGitTrackedPath(path, runGit)
      if (isTracked)
        await runGit(['submodule', 'deinit', '--', path])

      // Keep the module's Git database, including refs/reflogs not in the checkout.
      if (isTracked)
        await runGit(['rm', '--', path])
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
    await removeGitmodulesIfAllEntriesWereRemoved(root, results.submodules.filter(result => result.status === 'removed').map(result => result.path))

  for (const name of extraSkills) {
    if (yes) {
      await rm(join(root, GENERATED_SKILLS_DIR, name), { recursive: true, force: true })
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

function printCleanupResults(results: CleanupResult, yes: boolean): void {
  if (results.skills.length === 0 && results.submodules.length === 0) {
    console.log('Nothing to clean.')
    return
  }

  for (const result of results.submodules)
    console.log(`${result.status}: ${result.path}${result.status === 'skipped' ? ` — ${result.reason}` : ''}`)
  for (const result of results.skills)
    console.log(`${result.status}: ${GENERATED_SKILLS_DIR}/${result.name}`)

  if (!yes && (results.skills.length > 0 || results.submodules.some(result => result.status === 'would-remove')))
    console.log('Run with --yes to remove these entries.')
}

export async function run(args: string[]): Promise<void> {
  const unknown = args.find(arg => arg !== '--yes' && arg !== '-y')
  if (unknown)
    throw new Error(`Unknown argument: ${unknown}`)
  const yes = args.includes('--yes') || args.includes('-y')
  const results = await cleanupUnusedEntries({ yes })
  printCleanupResults(results, yes)
  if (results.submodules.some(result => result.status === 'skipped'))
    process.exitCode = 1
}
