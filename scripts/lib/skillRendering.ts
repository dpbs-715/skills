import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { localSkillSources as defaultLocalSkillSources } from '../../meta.ts'
import type { DocumentSkillSource, LocalSkillSource } from './metaTypes.ts'
import { pathExists, repoRoot } from './utils.ts'

export const REPO_ROOT_TOKEN = '{{REPO_ROOT}}'

export const GENERATED_SKILLS_DIR = 'generated'
export const SKILL_FILE = 'SKILL.md'

interface RenderLocalSkillSourcesOptions {
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

export function resolveRenderedInstructionSources(
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
}: RenderLocalSkillSourcesOptions = {}): Promise<string[]> {
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
