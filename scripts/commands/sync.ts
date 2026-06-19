import process from 'node:process'

import { vendors as defaultVendors, type VendorSkillMeta } from '../../meta.ts'
import { createGitRunner, type RunGit } from '../lib/git.ts'
import { repoRoot } from '../lib/utils.ts'
import {
  syncVendorSkills as defaultSyncVendorSkills,
  type SyncResult,
  type SyncVendorSkillsOptions,
} from '../lib/vendor.ts'

interface SyncOptions {
  root?: string
  runGit?: RunGit
  syncVendorSkills?: (options: SyncVendorSkillsOptions) => Promise<SyncResult[]>
  vendors?: Record<string, VendorSkillMeta>
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

function printSyncResults(results: SyncResult[]): void {
  if (results.length === 0) {
    console.log('No vendor skills configured.')
    return
  }

  for (const result of results)
    console.log(`${result.status}: ${result.vendor}/${result.sourceSkill} -> skills/${result.outputSkill}`)
}

export async function run(): Promise<void> {
  const results = await syncSubmodules()
  printSyncResults(results)
  if (results.some(result => result.status !== 'synced'))
    process.exitCode = 1
}
