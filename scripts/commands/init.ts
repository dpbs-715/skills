import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { vendors as defaultVendors, type VendorSkillMeta } from '../../meta.ts'
import {
  createGitRunner,
  getProjects,
  isGitTrackedPath,
  isGitWorkTree,
  type Project,
  restoreGitmodulesFromIndex,
  type RunGit,
  submoduleExists,
} from '../lib/git.ts'
import { repoRoot } from '../lib/utils.ts'

export interface InitResult {
  name: string
  path: string
  status: 'added' | 'exists' | 'initialized' | 'repaired'
  type: Project['type']
}

interface InitOptions {
  root?: string
  runGit?: RunGit
  vendors?: Record<string, VendorSkillMeta>
}

export async function initSubmodules({
  root = repoRoot(),
  runGit = createGitRunner(root),
  vendors = defaultVendors,
}: InitOptions = {}): Promise<InitResult[]> {
  const results: InitResult[] = []
  await restoreGitmodulesFromIndex(root, runGit)

  for (const project of getProjects({ vendors })) {
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

function printInitResults(results: InitResult[]): void {
  if (results.length === 0) {
    console.log('No submodules configured.')
    return
  }

  for (const result of results)
    console.log(`${result.status}: ${result.path}`)
}

export async function run(): Promise<void> {
  printInitResults(await initSubmodules())
}
