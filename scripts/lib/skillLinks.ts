import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  linkedSkills as defaultLinkedSkills,
  sourceSkills as defaultSourceSkills,
} from '../../meta.ts'
import { ensureLink, type LinkResult, pruneLinks } from './symlink.ts'
import { pathExists, repoRoot } from './utils.ts'

export const REPO_ROOT_TOKEN = '{{REPO_ROOT}}'

export const GENERATED_SKILLS_DIR = 'generated'
export const SKILL_FILE = 'SKILL.md'
export const SOURCE_SKILLS_DIR = 'skills'

export interface Skill {
  name: string
  source: string
}

interface SkillLinkOptions {
  linkedSkills?: readonly string[]
  root?: string
  targets: string[]
  sourceSkills?: readonly string[]
}

interface SourceOptions {
  root?: string
  sourceSkills?: readonly string[]
}

export async function renderSkillSources({
  root = repoRoot(),
  sourceSkills = defaultSourceSkills,
}: SourceOptions = {}): Promise<string[]> {
  const sourceSkillsDir = join(root, SOURCE_SKILLS_DIR)
  if (sourceSkills.length === 0)
    return []
  if (!await pathExists(sourceSkillsDir))
    throw new Error(`Missing configured source skill: ${SOURCE_SKILLS_DIR}/${sourceSkills[0]}/${SKILL_FILE}`)

  const entries = await readdir(sourceSkillsDir, { withFileTypes: true })
  const available = new Set(entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name))
  const rendered: string[] = []

  for (const name of sourceSkills) {
    const sourceDir = join(sourceSkillsDir, name)
    const sourcePath = join(sourceDir, SKILL_FILE)
    if (!available.has(name) || !await pathExists(sourcePath))
      throw new Error(`Missing configured source skill: ${SOURCE_SKILLS_DIR}/${name}/${SKILL_FILE}`)

    const source = await readFile(sourcePath, 'utf-8')
    const content = source.replaceAll(REPO_ROOT_TOKEN, root)
    const skillDir = join(root, GENERATED_SKILLS_DIR, name)
    await rm(skillDir, { recursive: true, force: true })
    await cp(sourceDir, skillDir, { recursive: true })
    await writeFile(join(skillDir, SKILL_FILE), content)
    rendered.push(name)
  }

  return rendered.sort((left, right) => left.localeCompare(right))
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

async function discoverLinkedSkills(root: string, linkedSkills: readonly string[]): Promise<Skill[]> {
  const skills = await discoverSkills(root)
  const byName = new Map(skills.map(skill => [skill.name, skill]))

  return linkedSkills
    .map((name) => {
      const skill = byName.get(name)
      if (!skill)
        throw new Error(`Missing configured linked skill: ${GENERATED_SKILLS_DIR}/${name}/${SKILL_FILE}`)
      return skill
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Link generated skill bundles into each target. Stale links pointing into the
 * repo's generated tree are pruned, so removed skills clean themselves up.
 */
export async function createSkillLinks({
  linkedSkills = defaultLinkedSkills,
  root = repoRoot(),
  targets,
  sourceSkills = defaultSourceSkills,
}: SkillLinkOptions): Promise<LinkResult[]> {
  await renderSkillSources({ root, sourceSkills })
  const skills = await discoverLinkedSkills(root, linkedSkills)
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
