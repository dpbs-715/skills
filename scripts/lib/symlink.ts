import { lstat, readdir, readlink, realpath, symlink, unlink } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'

import { pathExists } from './utils.ts'

export type LinkStatus = 'exists' | 'linked' | 'removed'

export interface LinkResult {
  name: string
  target: string
  status: LinkStatus
}

/** Expand a leading `~` to `$HOME`. */
export function homePath(path: string): string {
  const home = process.env.HOME
  if (!home)
    throw new Error('HOME is not set')

  if (path === '~')
    return home
  if (path.startsWith('~/'))
    return join(home, path.slice(2))
  return path
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path)
  }
  catch {
    return null
  }
}

/**
 * Create `linkPath` as a symlink to `source`. Returns `linked` for a new link,
 * `exists` when the correct link is already present, and refuses to clobber a
 * non-symlink or a symlink that points somewhere else.
 */
export async function ensureLink(source: string, linkPath: string): Promise<'exists' | 'linked'> {
  if (!await pathExists(linkPath)) {
    await symlink(source, linkPath)
    return 'linked'
  }

  const stat = await lstat(linkPath)
  if (!stat.isSymbolicLink())
    throw new Error(`Refusing to replace non-symlink: ${linkPath}`)

  const existing = await safeRealpath(linkPath)
  const expected = await realpath(source)
  if (existing === expected)
    return 'exists'

  throw new Error(`Refusing to replace symlink with different target: ${linkPath}`)
}

/**
 * Whether `linkPath` is a symlink whose target resolves to anywhere inside
 * `dir`. Uses the raw link target rather than realpath so dangling links (whose
 * source was deleted) are still recognised as owned by `dir`.
 */
export async function pointsIntoDir(linkPath: string, dir: string): Promise<boolean> {
  let target: string
  try {
    target = await readlink(linkPath)
  }
  catch {
    return false
  }

  const resolved = resolve(dirname(linkPath), target)
  return resolved === dir || resolved.startsWith(dir + sep)
}

/**
 * Remove symlinks under `target` that are owned by `dir` (per
 * {@link pointsIntoDir}) but are absent from `current`. Pass an empty `current`
 * to remove every owned link. Foreign links and dangling third-party links are
 * left untouched; repo-owned dangling links are pruned.
 */
export async function pruneLinks(target: string, current: Set<string>, dir: string): Promise<LinkResult[]> {
  const results: LinkResult[] = []
  if (!await pathExists(target))
    return results

  const entries = await readdir(target, { withFileTypes: true })
  for (const entry of entries) {
    if (current.has(entry.name))
      continue

    const linkPath = join(target, entry.name)
    if (!await pointsIntoDir(linkPath, dir))
      continue

    await unlink(linkPath)
    results.push({ name: entry.name, target, status: 'removed' })
  }

  return results
}
