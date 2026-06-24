import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { type ClaudeRule, claudeRules as defaultClaudeRules } from '../../meta.ts'
import { ensureLink, type LinkResult, pruneLinks } from './symlink.ts'
import { pathExists, repoRoot } from './utils.ts'

interface RuleLink {
  name: string
  source: string
}

interface RuleLinkOptions {
  rules?: readonly ClaudeRule[]
  root?: string
  targets: string[]
}

/**
 * Resolve each configured rule to an absolute source file and the `<skill>.md`
 * link name. Throws if a configured source is missing, mirroring skill linking.
 */
async function discoverRuleLinks(root: string, rules: readonly ClaudeRule[]): Promise<RuleLink[]> {
  const links: RuleLink[] = []

  for (const rule of rules) {
    const source = join(root, rule.source)
    if (!await pathExists(source))
      throw new Error(`Missing configured rule source: ${rule.source}`)
    links.push({ name: `${rule.skill}.md`, source })
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
  rules = defaultClaudeRules,
  root = repoRoot(),
  targets,
}: RuleLinkOptions): Promise<LinkResult[]> {
  const ruleLinks = await discoverRuleLinks(root, rules)
  const rulesDir = join(root, 'rules')
  const current = new Set(ruleLinks.map(link => link.name))
  const results: LinkResult[] = []

  for (const target of targets) {
    await mkdir(target, { recursive: true })

    for (const link of ruleLinks) {
      const status = await ensureLink(link.source, join(target, link.name))
      results.push({ name: link.name, target, status })
    }

    results.push(...await pruneLinks(target, current, rulesDir))
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
  const rulesDir = join(root, 'rules')
  const results: LinkResult[] = []

  for (const target of targets) {
    results.push(...await pruneLinks(target, new Set(), rulesDir))
  }

  return results
}
