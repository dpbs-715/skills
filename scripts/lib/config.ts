import { constants, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { LinkTarget, LocalSkillSource, VendorSkillMeta } from './metaTypes.ts'
import { pathExists, repoRoot } from './utils.ts'

export interface SkillsConfig {
  agentOnlySkills: readonly string[]
  alwaysOnInstructionSkills: readonly string[]
  installableSkills: readonly string[]
  linkTargets: readonly LinkTarget[]
  localSkillSources: readonly LocalSkillSource[]
  vendors: Record<string, VendorSkillMeta>
}

/** Missing local configuration uses the template without writing any files. */
export async function loadConfig(root = repoRoot()): Promise<SkillsConfig> {
  const local = join(root, 'meta.ts')
  const file = await pathExists(local) ? local : join(root, 'meta.template.ts')
  return import(pathToFileURL(file).href)
}

/** Create local configuration once; preserve existing files, including concurrent writes. */
export async function initConfig(root = repoRoot()): Promise<'created' | 'exists'> {
  try {
    await copyFile(join(root, 'meta.template.ts'), join(root, 'meta.ts'), constants.COPYFILE_EXCL)
    return 'created'
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
      return 'exists'
    throw error
  }
}

export const {
  agentOnlySkills,
  alwaysOnInstructionSkills,
  installableSkills,
  linkTargets,
  localSkillSources,
  vendors,
} = await loadConfig()
