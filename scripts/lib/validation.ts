import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'

import {
  agentOnlySkills as defaultAgentOnlySkills,
  installableSkills as defaultInstallableSkills,
  localSkillSources as defaultLocalSkillSources,
} from '../../meta.ts'
import { expectedAgentFiles, GENERATED_AGENTS_DIR } from './agents.ts'
import type { LocalSkillSource } from './metaTypes.ts'
import {
  GENERATED_SKILLS_DIR,
  renderDocumentSkill,
  REPO_ROOT_TOKEN,
  SKILL_FILE,
} from './skillRendering.ts'
import { pathExists, repoRoot } from './utils.ts'
import { readTeams } from './teams.ts'

export type ValidationIssueCode =
  | 'missing-directory-skill'
  | 'missing-document-source'
  | 'missing-generated-skill'
  | 'stale-generated-skill'
  | 'missing-installable-skill'
  | 'missing-agent-only-skill'
  | 'missing-frontmatter'
  | 'missing-frontmatter-field'
  | 'skill-name-mismatch'
  | 'missing-absolute-path'
  | 'invalid-agent'
  | 'missing-generated-agent'
  | 'stale-generated-agent'
  | 'unexpected-generated-agent'
  | 'invalid-team'

export interface ValidationIssue {
  code: ValidationIssueCode
  message: string
  path: string
}

export interface ValidationResult {
  issues: ValidationIssue[]
  ok: boolean
}

export interface ValidationOptions {
  agentOnlySkills?: readonly string[]
  installableSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
}

interface Frontmatter {
  description?: string
  name?: string
}

function addIssue(
  issues: ValidationIssue[],
  code: ValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, message, path })
}

function renderSourceContent(content: string, root: string): string {
  return content.replaceAll(REPO_ROOT_TOKEN, root)
}

function isRepoPath(root: string, path: string): boolean {
  const relPath = relative(root, path)
  return relPath === '' || (!relPath.startsWith('..') && !isAbsolute(relPath))
}

async function validateBacktickPaths(
  root: string,
  sourcePath: string,
  content: string,
  issues: ValidationIssue[],
): Promise<void> {
  const backtickPattern = /`([^`\n]+)`/g

  for (const match of content.matchAll(backtickPattern)) {
    const path = match[1].trim()
    if (!isAbsolute(path) || !isRepoPath(root, path))
      continue

    if (!await pathExists(path)) {
      addIssue(
        issues,
        'missing-absolute-path',
        sourcePath,
        `Referenced repo path does not exist: ${path}`,
      )
    }
  }
}

async function validateLocalSkillSources(
  root: string,
  localSkillSources: readonly LocalSkillSource[],
  issues: ValidationIssue[],
): Promise<void> {
  for (const source of localSkillSources) {
    const generatedRelPath = join(GENERATED_SKILLS_DIR, source.name, SKILL_FILE)
    const generatedPath = join(root, generatedRelPath)
    let expected: string

    if (source.kind === 'directory') {
      const sourceRelPath = join(source.path, SKILL_FILE)
      const sourcePath = join(root, sourceRelPath)
      if (!await pathExists(sourcePath)) {
        addIssue(
          issues,
          'missing-directory-skill',
          sourceRelPath,
          `Missing configured directory skill: ${sourceRelPath}`,
        )
        continue
      }

      expected = renderSourceContent(await readFile(sourcePath, 'utf-8'), root)
      await validateBacktickPaths(root, sourceRelPath, expected, issues)
    }
    else {
      const sourcePath = join(root, source.source)
      if (!await pathExists(sourcePath)) {
        addIssue(
          issues,
          'missing-document-source',
          source.source,
          `Missing configured document source: ${source.source}`,
        )
        continue
      }

      expected = renderDocumentSkill(source, await readFile(sourcePath, 'utf-8'), root)
      await validateBacktickPaths(root, source.source, expected, issues)
    }

    if (!await pathExists(generatedPath)) {
      addIssue(
        issues,
        'missing-generated-skill',
        generatedRelPath,
        `Missing generated skill from source: ${generatedRelPath}`,
      )
      continue
    }

    const actual = await readFile(generatedPath, 'utf-8')
    await validateBacktickPaths(root, generatedRelPath, actual, issues)

    if (actual !== expected) {
      addIssue(
        issues,
        'stale-generated-skill',
        generatedRelPath,
        `Generated skill is stale; run pnpm skills link to refresh ${generatedRelPath}`,
      )
    }
  }
}

async function validateInstallableSkills(
  root: string,
  installableSkills: readonly string[],
  issues: ValidationIssue[],
): Promise<void> {
  for (const name of installableSkills) {
    const relPath = join(GENERATED_SKILLS_DIR, name, SKILL_FILE)
    if (!await pathExists(join(root, relPath))) {
      addIssue(
        issues,
        'missing-installable-skill',
        relPath,
        `Missing configured installable skill: ${relPath}`,
      )
    }
  }
}

async function validateAgentOnlySkills(
  root: string,
  agentOnlySkills: readonly string[],
  issues: ValidationIssue[],
): Promise<void> {
  for (const name of agentOnlySkills) {
    const relPath = join(GENERATED_SKILLS_DIR, name, SKILL_FILE)
    if (!await pathExists(join(root, relPath))) {
      addIssue(
        issues,
        'missing-agent-only-skill',
        relPath,
        `Missing configured agent-only skill; run pnpm skills sync or pnpm skills link: ${relPath}`,
      )
    }
  }
}

async function validateAgents(root: string, issues: ValidationIssue[]): Promise<void> {
  let expected: Awaited<ReturnType<typeof expectedAgentFiles>>
  try {
    expected = await expectedAgentFiles(root)
  }
  catch (error) {
    addIssue(issues, 'invalid-agent', 'agents', error instanceof Error ? error.message : String(error))
    return
  }

  const expectedPaths = new Set<string>()
  for (const agent of expected) {
    const relPath = join(GENERATED_AGENTS_DIR, agent.format, `${agent.name}.md`)
    expectedPaths.add(relPath)
    const path = join(root, relPath)
    if (!await pathExists(path)) {
      addIssue(issues, 'missing-generated-agent', relPath, `Missing generated agent; run pnpm skills link: ${relPath}`)
    }
    else if (await readFile(path, 'utf8') !== agent.content) {
      addIssue(issues, 'stale-generated-agent', relPath, `Generated agent is stale; run pnpm skills link: ${relPath}`)
    }
  }

  const generatedDir = join(root, GENERATED_AGENTS_DIR)
  if (!await pathExists(generatedDir))
    return

  const entries = await readdir(generatedDir, { recursive: true, withFileTypes: true })
  const actualPaths = entries
    .filter(entry => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.md'))
    .map(entry => relative(root, join(entry.parentPath, entry.name)))
    .sort()
  for (const relPath of actualPaths) {
    if (!expectedPaths.has(relPath))
      addIssue(issues, 'unexpected-generated-agent', relPath, `Generated agent has no matching source; run pnpm skills link: ${relPath}`)
  }
}

async function validateTeams(root: string, issues: ValidationIssue[]): Promise<void> {
  try {
    await readTeams(root)
  }
  catch (error) {
    addIssue(issues, 'invalid-team', 'teams', error instanceof Error ? error.message : String(error))
  }
}

function parseFrontmatter(content: string): Frontmatter | undefined {
  const normalized = content.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n'))
    return undefined

  const endIndex = normalized.indexOf('\n---', 4)
  if (endIndex === -1)
    return undefined

  const fields: Frontmatter = {}
  const lines = normalized.slice(4, endIndex).split('\n')

  for (const line of lines) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1)
      continue

    const key = line.slice(0, separatorIndex).trim()
    const value = unquote(line.slice(separatorIndex + 1).trim())
    if (key === 'name')
      fields.name = value
    if (key === 'description')
      fields.description = value
  }

  return fields
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith('\'') && value.endsWith('\''))
  )
    return value.slice(1, -1)
  return value
}

async function validateSkillFrontmatter(
  root: string,
  issues: ValidationIssue[],
): Promise<void> {
  const skillsDir = join(root, GENERATED_SKILLS_DIR)
  if (!await pathExists(skillsDir))
    return

  const entries = await readdir(skillsDir, { withFileTypes: true })
  const skillDirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  for (const name of skillDirs) {
    const relPath = join(GENERATED_SKILLS_DIR, name, SKILL_FILE)
    const skillPath = join(root, relPath)
    if (!await pathExists(skillPath))
      continue

    const content = await readFile(skillPath, 'utf-8')
    const frontmatter = parseFrontmatter(content)
    if (!frontmatter) {
      addIssue(
        issues,
        'missing-frontmatter',
        relPath,
        `Skill file must start with frontmatter: ${relPath}`,
      )
      continue
    }

    if (!frontmatter.name) {
      addIssue(
        issues,
        'missing-frontmatter-field',
        relPath,
        `Skill frontmatter is missing name: ${relPath}`,
      )
    }
    else if (frontmatter.name !== name) {
      addIssue(
        issues,
        'skill-name-mismatch',
        relPath,
        `Skill frontmatter name must equal directory name: expected ${name}, got ${frontmatter.name}`,
      )
    }

    if (!frontmatter.description) {
      addIssue(
        issues,
        'missing-frontmatter-field',
        relPath,
        `Skill frontmatter is missing description: ${relPath}`,
      )
    }
  }
}

export async function validateSkills({
  agentOnlySkills = defaultAgentOnlySkills,
  installableSkills = defaultInstallableSkills,
  localSkillSources = defaultLocalSkillSources,
  root = repoRoot(),
}: ValidationOptions = {}): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  await validateLocalSkillSources(root, localSkillSources, issues)
  await validateInstallableSkills(root, installableSkills, issues)
  await validateAgentOnlySkills(root, agentOnlySkills, issues)
  await validateSkillFrontmatter(root, issues)
  await validateAgents(root, issues)
  await validateTeams(root, issues)

  return {
    issues,
    ok: issues.length === 0,
  }
}
