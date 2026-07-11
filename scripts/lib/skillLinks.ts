import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import {
  installableSkills as defaultInstallableSkills,
  localSkillSources as defaultLocalSkillSources,
} from '../../meta.ts'
import type { DocumentSkillSource, LocalSkillSource } from './metaTypes.ts'
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
  installableSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
  targets: string[]
}

interface LocalSourceOptions {
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
}

function resolveDocumentLinks(content: string, root: string, sourcePath: string): string {
  const sourceDir = dirname(join(root, sourcePath))

  return content
    .replaceAll(REPO_ROOT_TOKEN, root)
    .replace(/\]\(([^)]+)\)/g, (link, target: string) => {
      const trimmedTarget = target.trim()
      if (
        isAbsolute(trimmedTarget)
        || trimmedTarget.startsWith('#')
        || /^[a-z][a-z\d+.-]*:/i.test(trimmedTarget)
      )
        return link

      const absoluteTarget = resolve(sourceDir, trimmedTarget)
      return `](${absoluteTarget.includes(' ') ? `<${absoluteTarget}>` : absoluteTarget})`
    })
}

export function renderDocumentSkill(
  source: DocumentSkillSource,
  sourceContent: string,
  root: string,
): string {
  const metadata = source.shortDescription
    ? `metadata:\n  short-description: ${source.shortDescription}\n`
    : ''
  const instructions = source.instructions.join('\n\n')
  const documentBody = resolveDocumentLinks(sourceContent, root, source.source)
    .replace(/^# [^\n]+\n+/, '')
    .trim()

  return `---
name: ${source.name}
description: ${source.description}
${metadata}---

# ${source.title}

Source: \`${join(root, source.source)}\`.

${instructions}

${documentBody}
`
}

async function renderDirectorySkill(root: string, source: LocalSkillSource): Promise<void> {
  if (source.kind !== 'directory')
    throw new Error(`Expected directory skill source: ${source.name}`)

  const sourceDir = join(root, source.path)
  const sourcePath = join(sourceDir, SKILL_FILE)
  if (!await pathExists(sourcePath))
    throw new Error(`Missing configured directory skill: ${source.path}/${SKILL_FILE}`)

  const content = (await readFile(sourcePath, 'utf-8')).replaceAll(REPO_ROOT_TOKEN, root)
  const skillDir = join(root, GENERATED_SKILLS_DIR, source.name)
  await rm(skillDir, { recursive: true, force: true })
  await cp(sourceDir, skillDir, { recursive: true })
  await writeFile(join(skillDir, SKILL_FILE), content)
}

async function renderDocumentSkillSource(root: string, source: LocalSkillSource): Promise<void> {
  if (source.kind !== 'document')
    throw new Error(`Expected document skill source: ${source.name}`)

  if (!await pathExists(join(root, source.source)))
    throw new Error(`Missing configured document source: ${source.source}`)

  const skillDir = join(root, GENERATED_SKILLS_DIR, source.name)
  await rm(skillDir, { recursive: true, force: true })
  await mkdir(skillDir, { recursive: true })
  const sourceContent = await readFile(join(root, source.source), 'utf-8')
  await writeFile(
    join(skillDir, SKILL_FILE),
    renderDocumentSkill(source, sourceContent, root),
  )
}

export function resolveAlwaysOnInstructionSources(
  localSkillSources: readonly LocalSkillSource[],
  skillNames: readonly string[],
): Array<{ skill: string, source: string }> {
  const byName = new Map(localSkillSources.map(source => [source.name, source]))

  return skillNames.map((skill) => {
    const source = byName.get(skill)
    if (!source)
      throw new Error(`Missing configured instruction skill: ${skill}`)
    if (source.kind !== 'document')
      throw new Error(`Instruction skill must be document-backed: ${skill}`)
    return { skill, source: join(GENERATED_SKILLS_DIR, skill, SKILL_FILE) }
  })
}

export async function renderLocalSkillSources({
  root = repoRoot(),
  localSkillSources = defaultLocalSkillSources,
}: LocalSourceOptions = {}): Promise<string[]> {
  const rendered: string[] = []

  for (const source of localSkillSources) {
    if (source.kind === 'directory')
      await renderDirectorySkill(root, source)
    else
      await renderDocumentSkillSource(root, source)

    rendered.push(source.name)
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
  localSkillSources = defaultLocalSkillSources,
  root = repoRoot(),
  targets,
}: SkillLinkOptions): Promise<LinkResult[]> {
  await renderLocalSkillSources({ root, localSkillSources })
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
