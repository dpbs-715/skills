import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { ensureLink, type LinkResult, pruneLinks } from './symlink.ts'
import { pathExists, repoRoot } from './utils.ts'

interface RuleLink {
  name: string
  source: string
}

interface RuleLinkOptions {
  instructions: readonly RuleInstruction[]
  root?: string
  targets: string[]
}

export interface RuleInstruction {
  skill: string
  source: string
}

/**
 * Resolve each configured rule to an absolute source file and the `<skill>.md`
 * link name. Throws if a configured source is missing, mirroring skill linking.
 */
async function discoverRuleLinks(root: string, instructions: readonly RuleInstruction[]): Promise<RuleLink[]> {
  const links: RuleLink[] = []

  for (const instruction of instructions) {
    const source = join(root, instruction.source)
    if (!await pathExists(source))
      throw new Error(`Missing configured instruction source: ${instruction.source}`)
    links.push({ name: `${instruction.skill}.md`, source })
  }

  return links.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Link configured rules as markdown into each target (e.g. `~/.claude/rules`).
 * The target directory is created if missing, since `~/.claude/rules` does not
 * exist by default. Stale links pointing into the repo's `rules/` tree are
 * pruned, so rules removed from the manifest clean themselves up.
 */
export async function createRuleLinks({
  instructions,
  root = repoRoot(),
  targets,
}: RuleLinkOptions): Promise<LinkResult[]> {
  const ruleLinks = await discoverRuleLinks(root, instructions)
  const ownedDirs = [join(root, 'rules'), join(root, 'generated')]
  const current = new Set(ruleLinks.map(link => link.name))
  const results: LinkResult[] = []

  for (const target of targets) {
    await mkdir(target, { recursive: true })

    for (const link of ruleLinks) {
      const status = await ensureLink(link.source, join(target, link.name), {
        replaceFrom: ownedDirs,
      })
      results.push({ name: link.name, target, status })
    }

    for (const ownedDir of ownedDirs)
      results.push(...await pruneLinks(target, current, ownedDir))
  }

  return results
}

export async function removeRuleLinks({
  root = repoRoot(),
  targets,
}: {
  root?: string
  targets: string[]
}): Promise<LinkResult[]> {
  const ownedDirs = [join(root, 'rules'), join(root, 'generated')]
  const results: LinkResult[] = []

  for (const target of targets) {
    for (const ownedDir of ownedDirs)
      results.push(...await pruneLinks(target, new Set(), ownedDir))
  }

  return results
}
