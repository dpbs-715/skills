import { dirname } from 'node:path'

import {
  type ClaudeRule,
  claudeRules as defaultClaudeRules,
  type LinkTarget,
  linkTargets as defaultLinkTargets,
} from '../../meta.ts'
import { createRuleLinks, removeRuleLinks } from '../lib/ruleLinks.ts'
import { createSkillLinks, removeSkillLinks, renderSkillTemplates } from '../lib/skillLinks.ts'
import { homePath, type LinkResult } from '../lib/symlink.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

interface OrchestrateOptions {
  root?: string
  targets?: readonly LinkTarget[]
  templateSkills?: readonly string[]
}

/** Resolve a skill name to its configured rule (source markdown). */
function resolveRule(skill: string): ClaudeRule {
  const rule = defaultClaudeRules.find(entry => entry.skill === skill)
  if (!rule)
    throw new Error(`Unknown Claude rule: ${skill}`)
  return rule
}

/**
 * Link every {@link defaultLinkTargets} row to its destination, dispatching on
 * `kind`. Skill directories are only populated when they already exist (the
 * tool is installed); the rule directory is created when its parent (e.g.
 * `~/.claude`) exists. Templates are rendered once up front so the per-target
 * skill linking below skips re-rendering.
 */
export async function linkAll({
  root = repoRoot(),
  targets = defaultLinkTargets,
  templateSkills,
}: OrchestrateOptions = {}): Promise<LinkResult[]> {
  await renderSkillTemplates({ root, templateSkills })
  const results: LinkResult[] = []

  for (const target of targets) {
    const dir = homePath(target.dir)

    if (target.kind === 'skill') {
      if (!await pathExists(dir))
        continue
      results.push(...await createSkillLinks({
        root,
        linkedSkills: target.include,
        targets: [dir],
        templateSkills: [],
      }))
      continue
    }

    if (!await pathExists(dirname(dir)))
      continue
    results.push(...await createRuleLinks({
      root,
      rules: target.include.map(resolveRule),
      targets: [dir],
    }))
  }

  return results
}

/** Remove repo-owned links from every {@link defaultLinkTargets} destination. */
export async function unlinkAll({
  root = repoRoot(),
  targets = defaultLinkTargets,
}: OrchestrateOptions = {}): Promise<LinkResult[]> {
  const results: LinkResult[] = []

  for (const target of targets) {
    const dir = homePath(target.dir)
    if (target.kind === 'skill')
      results.push(...await removeSkillLinks({ root, targets: [dir] }))
    else
      results.push(...await removeRuleLinks({ root, targets: [dir] }))
  }

  return results
}

function parseTargets(args: string[]): string[] {
  const targets: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--target') {
      const value = args[index + 1]
      if (!value)
        throw new Error('--target requires a path')
      targets.push(homePath(value))
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return targets
}

function printResults(results: LinkResult[]): void {
  if (results.length === 0) {
    console.log('No skill links changed.')
    return
  }

  for (const result of results) {
    console.log(`${result.status}: ${result.target}/${result.name}`)
  }
}

export async function runLink(args: string[]): Promise<void> {
  const targets = parseTargets(args)

  // Explicit --target keeps the legacy behavior: link the full skill set into
  // the given directories (no per-target filtering, no rule linking).
  if (targets.length > 0) {
    printResults(await createSkillLinks({ targets }))
    return
  }

  printResults(await linkAll())
}

export async function runUnlink(args: string[]): Promise<void> {
  const targets = parseTargets(args)

  if (targets.length > 0) {
    printResults(await removeSkillLinks({ targets }))
    return
  }

  printResults(await unlinkAll())
}
