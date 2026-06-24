import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  linkedSkills as defaultLinkedSkills,
  templateSkills as defaultTemplateSkills,
} from '../../meta.ts'
import { ensureLink, type LinkResult, pruneLinks } from './symlink.ts'
import { pathExists, repoRoot } from './utils.ts'

/**
 * Placeholder inside a skill template (`templates/<name>/SKILL.md`) replaced
 * with this repo's absolute path at link time, so a skill can reference files
 * outside its own directory without hardcoding one machine's checkout location.
 */
export const REPO_ROOT_TOKEN = '{{REPO_ROOT}}'

const TEMPLATES_DIR = 'templates'
const SKILL_FILE = 'SKILL.md'

export interface Skill {
  name: string
  source: string
}

interface SkillLinkOptions {
  linkedSkills?: readonly string[]
  root?: string
  targets: string[]
  templateSkills?: readonly string[]
}

interface TemplateOptions {
  root?: string
  templateSkills?: readonly string[]
}

/**
 * Render each `templates/<name>/SKILL.md` into `skills/<name>/SKILL.md`,
 * substituting the repo root for {@link REPO_ROOT_TOKEN}. Templates live outside
 * `skills/` so they never ride along into the symlinked skill bundle; only the
 * generated `SKILL.md` is linked. The generated skill directory is a build
 * artifact and should be gitignored.
 */
export async function renderSkillTemplates({
  root = repoRoot(),
  templateSkills = defaultTemplateSkills,
}: TemplateOptions = {}): Promise<string[]> {
  const templatesDir = join(root, TEMPLATES_DIR)
  if (templateSkills.length === 0)
    return []
  if (!await pathExists(templatesDir))
    throw new Error(`Missing configured skill template: templates/${templateSkills[0]}/${SKILL_FILE}`)

  const entries = await readdir(templatesDir, { withFileTypes: true })
  const available = new Set(entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name))
  const rendered: string[] = []

  for (const name of templateSkills) {
    const templatePath = join(templatesDir, name, SKILL_FILE)
    if (!available.has(name) || !await pathExists(templatePath))
      throw new Error(`Missing configured skill template: templates/${name}/${SKILL_FILE}`)

    const template = await readFile(templatePath, 'utf-8')
    const content = template.replaceAll(REPO_ROOT_TOKEN, root)
    const skillDir = join(root, 'skills', name)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, SKILL_FILE), content)
    rendered.push(name)
  }

  return rendered.sort((left, right) => left.localeCompare(right))
}

export async function discoverSkills(root = repoRoot()): Promise<Skill[]> {
  const skillsDir = join(root, 'skills')
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
        throw new Error(`Missing configured linked skill: skills/${name}/${SKILL_FILE}`)
      return skill
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Link the configured skills (directories) into each target, rendering any
 * templated skills first. Stale links pointing into the repo's `skills/` tree
 * are pruned, so skills removed from a target's set clean themselves up.
 */
export async function createSkillLinks({
  linkedSkills = defaultLinkedSkills,
  root = repoRoot(),
  targets,
  templateSkills = defaultTemplateSkills,
}: SkillLinkOptions): Promise<LinkResult[]> {
  await renderSkillTemplates({ root, templateSkills })
  const skills = await discoverLinkedSkills(root, linkedSkills)
  const skillsDir = join(root, 'skills')
  const current = new Set(skills.map(skill => skill.name))
  const results: LinkResult[] = []

  for (const target of targets) {
    await mkdir(target, { recursive: true })

    for (const skill of skills) {
      const status = await ensureLink(skill.source, join(target, skill.name))
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
  const skillsDir = join(root, 'skills')
  const results: LinkResult[] = []

  for (const target of targets) {
    results.push(...await pruneLinks(target, new Set(), skillsDir))
  }

  return results
}
