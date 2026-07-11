import { dirname, isAbsolute, relative, sep } from 'node:path'

import {
  alwaysOnInstructionSkills as defaultAlwaysOnInstructionSkills,
  localSkillSources as defaultLocalSkillSources,
  linkTargets as defaultLinkTargets,
} from '../../meta.ts'
import { ensureJsonArrayEntries, ensureJsonObjectEntries } from '../lib/jsonConfig.ts'
import { createInstructionLinks, removeInstructionLinks } from '../lib/instructionLinks.ts'
import type { LinkTarget, LocalSkillSource } from '../lib/metaTypes.ts'
import {
  createSkillLinks,
  removeSkillLinks,
} from '../lib/skillLinks.ts'
import {
  renderLocalSkillSources,
  REPO_ROOT_TOKEN,
  resolveRenderedInstructionSources,
} from '../lib/skillRendering.ts'
import { homePath, type LinkResult } from '../lib/symlink.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

interface OrchestrateOptions {
  alwaysOnInstructionSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
  targets?: readonly LinkTarget[]
}

function homeRelativePath(path: string): string {
  const home = homePath('~')
  const relativePath = relative(home, path)

  if (relativePath === '')
    return '~'
  if (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
    return `~/${relativePath.split(sep).join('/')}`
  return path
}

function resolveJsonObjectEntries(
  entries: readonly { key: string, value: string }[],
  root: string,
): Array<{ key: string, value: string }> {
  return entries.map(entry => ({
    key: entry.key.includes(REPO_ROOT_TOKEN)
      ? homeRelativePath(entry.key.replaceAll(REPO_ROOT_TOKEN, root))
      : entry.key,
    value: entry.value,
  }))
}

/**
 * Link every {@link defaultLinkTargets} row to its destination, dispatching on
 * `kind`. Skill directories are only populated when they already exist (the
 * tool is installed); the rule directory is created when its parent exists.
 * Local skill sources are rendered once up front so the per-target skill
 * linking below skips re-rendering.
 */
export async function linkAll({
  alwaysOnInstructionSkills = defaultAlwaysOnInstructionSkills,
  localSkillSources = defaultLocalSkillSources,
  root = repoRoot(),
  targets = defaultLinkTargets,
}: OrchestrateOptions = {}): Promise<LinkResult[]> {
  await renderLocalSkillSources({ root, localSkillSources })
  const results: LinkResult[] = []

  for (const target of targets) {
    if (target.kind === 'skill') {
      const dir = homePath(target.dir)
      if (!await pathExists(dir))
        continue
      results.push(...await createSkillLinks({
        root,
        installableSkills: target.include,
        targets: [dir],
      }))
      continue
    }

    if (target.kind === 'json-array') {
      const file = homePath(target.file)
      if (!await pathExists(dirname(file)))
        continue
      results.push(...await ensureJsonArrayEntries({
        file,
        property: target.property,
        values: target.include,
      }))
      continue
    }

    if (target.kind === 'json-object') {
      const file = homePath(target.file)
      if (!await pathExists(dirname(file)))
        continue
      results.push(...await ensureJsonObjectEntries({
        entries: resolveJsonObjectEntries(target.entries, root),
        file,
        path: target.path,
      }))
      continue
    }

    const dir = homePath(target.dir)
    if (!await pathExists(dirname(dir)))
      continue
    results.push(...await createInstructionLinks({
      instructions: resolveRenderedInstructionSources(
        localSkillSources,
        target.include.length > 0 ? target.include : alwaysOnInstructionSkills,
      ),
      root,
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
    if (target.kind === 'json-array' || target.kind === 'json-object')
      continue

    const dir = homePath(target.dir)
    if (target.kind === 'skill')
      results.push(...await removeSkillLinks({ root, targets: [dir] }))
    else
      results.push(...await removeInstructionLinks({ root, targets: [dir] }))
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
    await renderLocalSkillSources()
    printResults(await createSkillLinks({ targets }))
    return
  }

  printResults(await linkAll())
}

export async function runUnlink(args: string[]): Promise<void> {
  const targets = parseTargets(args)

  if (targets.length > 0) {
    // An explicit --target carries no `kind`, and a directory may hold skill
    // links (into repo `generated/`) or rule links (into repo `rules/`) — e.g.
    // `~/.claude/rules` holds the latter. Prune both: each pruner only removes
    // links it owns, so the absent kind and any foreign links are untouched.
    printResults([
      ...await removeSkillLinks({ targets }),
      ...await removeInstructionLinks({ targets }),
    ])
    return
  }

  printResults(await unlinkAll())
}
