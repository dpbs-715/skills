import { execFile } from 'node:child_process'
import { lstat, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Absolute path to the repository root, anchored to this file's location
 * (`scripts/lib/`) so callers get the same answer no matter how deeply they
 * live under `scripts/`.
 */
export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return false
    throw error
  }
}

export async function execFileText(command: string, args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    cwd,
    encoding: 'utf-8',
  })
  return stdout.trim()
}

export async function listDirectories(path: string): Promise<string[]> {
  if (!await pathExists(path))
    return []

  const entries = await readdir(path, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}

export async function isDirectoryNonEmpty(path: string): Promise<boolean> {
  if (!await pathExists(path))
    return false

  const entries = await readdir(path)
  return entries.length > 0
}
