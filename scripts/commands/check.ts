import { join } from 'node:path'

import { vendors as defaultVendors } from '../../meta.ts'
import {
  createGitRunner,
  getProjects,
  isGitWorkTree,
  parseBehindCount,
  type Project,
  resolveRemoteComparisonRef,
  type RunGit,
} from '../lib/git.ts'
import type { VendorSkillMeta } from '../lib/metaTypes.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

export interface UpdateResult {
  behind: number
  name: string
  path: string
  type: Project['type']
}

interface CheckOptions {
  root?: string
  runGit?: RunGit
  vendors?: Record<string, VendorSkillMeta>
}

export async function checkUpdates({
  root = repoRoot(),
  runGit = createGitRunner(root),
  vendors = defaultVendors,
}: CheckOptions = {}): Promise<UpdateResult[]> {
  const updates: UpdateResult[] = []

  for (const project of getProjects({ vendors })) {
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

function printUpdates(updates: UpdateResult[]): void {
  if (updates.length === 0) {
    console.log('All submodules are up to date.')
    return
  }

  for (const update of updates)
    console.log(`${update.path}: ${update.behind} commit(s) behind`)
}

export async function run(): Promise<void> {
  printUpdates(await checkUpdates())
}
