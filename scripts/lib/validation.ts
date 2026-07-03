import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'

import {
  type ClaudeRule,
  claudeRules as defaultClaudeRules,
  linkedSkills as defaultLinkedSkills,
  sourceSkills as defaultSourceSkills,
} from '../../meta.ts'
import { GENERATED_SKILLS_DIR, REPO_ROOT_TOKEN, SKILL_FILE, SOURCE_SKILLS_DIR } from './skillLinks.ts'
import { pathExists, repoRoot } from './utils.ts'

export type ValidationIssueCode =
  | 'missing-source-skill'
  | 'missing-generated-skill'
  | 'stale-generated-skill'
  | 'missing-linked-skill'
  | 'missing-rule-source'
  | 'missing-frontmatter'
  | 'missing-frontmatter-field'
  | 'skill-name-mismatch'
  | 'missing-absolute-path'

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
  claudeRules?: readonly ClaudeRule[]
  linkedSkills?: readonly string[]
  root?: string
  sourceSkills?: readonly string[]
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

function renderSourceSkill(content: string, root: string): string {
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

async function validateSourceSkills(
  root: string,
  sourceSkills: readonly string[],
  issues: ValidationIssue[],
): Promise<void> {
  for (const name of sourceSkills) {
    const sourceRelPath = join(SOURCE_SKILLS_DIR, name, SKILL_FILE)
    const sourcePath = join(root, sourceRelPath)
    const generatedRelPath = join(GENERATED_SKILLS_DIR, name, SKILL_FILE)
    const generatedPath = join(root, generatedRelPath)

    if (!await pathExists(sourcePath)) {
      addIssue(
        issues,
        'missing-source-skill',
        sourceRelPath,
        `Missing configured source skill: ${sourceRelPath}`,
      )
      continue
    }

    const expected = renderSourceSkill(await readFile(sourcePath, 'utf-8'), root)
    await validateBacktickPaths(root, sourceRelPath, expected, issues)

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

async function validateLinkedSkills(
  root: string,
  linkedSkills: readonly string[],
  issues: ValidationIssue[],
): Promise<void> {
  for (const name of linkedSkills) {
    const relPath = join(GENERATED_SKILLS_DIR, name, SKILL_FILE)
    if (!await pathExists(join(root, relPath))) {
      addIssue(
        issues,
        'missing-linked-skill',
        relPath,
        `Missing configured linked skill: ${relPath}`,
      )
    }
  }
}

async function validateClaudeRules(
  root: string,
  claudeRules: readonly ClaudeRule[],
  issues: ValidationIssue[],
): Promise<void> {
  for (const rule of claudeRules) {
    if (!await pathExists(join(root, rule.source))) {
      addIssue(
        issues,
        'missing-rule-source',
        rule.source,
        `Missing configured Claude rule source for ${rule.skill}: ${rule.source}`,
      )
    }
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
  claudeRules = defaultClaudeRules,
  linkedSkills = defaultLinkedSkills,
  root = repoRoot(),
  sourceSkills = defaultSourceSkills,
}: ValidationOptions = {}): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  await validateSourceSkills(root, sourceSkills, issues)
  await validateLinkedSkills(root, linkedSkills, issues)
  await validateClaudeRules(root, claudeRules, issues)
  await validateSkillFrontmatter(root, issues)

  return {
    issues,
    ok: issues.length === 0,
  }
}
