import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { installableSkills as defaultInstallableSkills } from '../../meta.ts'
import { GENERATED_SKILLS_DIR, SKILL_FILE } from './skillRendering.ts'
import { ensureLink, type LinkResult, pruneLinks } from './symlink.ts'
import { pathExists, repoRoot } from './utils.ts'

export const SOURCE_SKILLS_DIR = 'skills'

export interface Skill {
  name: string
  source: string
}

interface SkillLinkOptions {
  installableSkills?: readonly string[]
  root?: string
  targets: string[]
}

export async function discoverSkills(root = repoRoot()): Promise<Skill[]> {
  const skillsDir = join(root, GENERATED_SKILLS_DIR)
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

async function discoverInstallableSkills(root: string, installableSkills: readonly string[]): Promise<Skill[]> {
  const skills = await discoverSkills(root)
  const byName = new Map(skills.map(skill => [skill.name, skill]))

  return installableSkills
    .map((name) => {
      const skill = byName.get(name)
      if (!skill)
        throw new Error(`Missing configured installable skill: ${GENERATED_SKILLS_DIR}/${name}/${SKILL_FILE}`)
      return skill
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Link generated skill bundles into each target. Stale links pointing into the
 * repo's generated tree are pruned, so removed skills clean themselves up.
 */
export async function createSkillLinks({
  installableSkills = defaultInstallableSkills,
  root = repoRoot(),
  targets,
}: SkillLinkOptions): Promise<LinkResult[]> {
  const skills = await discoverInstallableSkills(root, installableSkills)
  const skillsDir = join(root, GENERATED_SKILLS_DIR)
  const replaceFrom = [join(root, SOURCE_SKILLS_DIR), skillsDir]
  const current = new Set(skills.map(skill => skill.name))
  const results: LinkResult[] = []

  for (const target of targets) {
    await mkdir(target, { recursive: true })

    for (const skill of skills) {
      const status = await ensureLink(skill.source, join(target, skill.name), { replaceFrom })
      results.push({ name: skill.name, target, status })
    }

    results.push(...await pruneLinks(target, current, skillsDir))
  }

  return results
}

export async function removeSkillLinks({
  root = repoRoot(),
  targets,
}: {
  root?: string
  targets: string[]
}): Promise<LinkResult[]> {
  const skillsDir = join(root, GENERATED_SKILLS_DIR)
  const results: LinkResult[] = []

  for (const target of targets) {
    results.push(...await pruneLinks(target, new Set(), skillsDir))
  }

  return results
}
