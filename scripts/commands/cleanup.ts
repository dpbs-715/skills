import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import {
  installableSkills as defaultInstallableSkills,
  localSkillSources as defaultLocalSkillSources,
  vendors as defaultVendors,
} from '../../meta.ts'
import {
  createGitRunner,
  getExistingSubmodulePaths,
  getProjects,
  isGitTrackedPath,
  isManagedSubmodulePath,
  removeGitmodulesIfAllEntriesWereRemoved,
  removeGitmodulesIfNoEntries,
  type RunGit,
} from '../lib/git.ts'
import type { LocalSkillSource, VendorSkillMeta } from '../lib/metaTypes.ts'
import { GENERATED_SKILLS_DIR } from '../lib/skillLinks.ts'
import { listDirectories, repoRoot } from '../lib/utils.ts'

export interface CleanupResult {
  skills: Array<{ name: string, status: 'removed' | 'would-remove' }>
  submodules: Array<{ path: string, status: 'removed' | 'would-remove' }>
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
    console.log(`${result.status}: ${result.path}`)
  for (const result of results.skills)
    console.log(`${result.status}: ${GENERATED_SKILLS_DIR}/${result.name}`)

  if (!yes)
    console.log('Run with --yes to remove these entries.')
}

export async function run(args: string[]): Promise<void> {
  const yes = args.includes('--yes') || args.includes('-y')
  printCleanupResults(await cleanupUnusedEntries({ yes }), yes)
}
