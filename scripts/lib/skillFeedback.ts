import { createHash, randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import { constants, link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import process from 'node:process'

import { loadConfig } from './config.ts'
import { repoRoot } from './utils.ts'

const enabledContents = 'enabled\n'
const textLimits = {
  component: 80, source: 200, title: 120, impact: 300, operation: 300, failure: 300,
  steps: 1600, cause: 800, recommendation: 1000,
} as const
type Report = Record<keyof typeof textLimits, string> & { sourceDigest?: string }
type Result = { status: 'disabled' } | { status: 'saved' | 'existing', path: string }

function parseReport(input: unknown): Report {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Feedback input must be a JSON object.')
  const values = input as Record<string, unknown>
  if (Object.keys(values).some(key => !Object.hasOwn(textLimits, key) && key !== 'sourceDigest'))
    throw new Error('Feedback contains an unsupported field.')
  const report = {} as Report
  for (const [key, max] of Object.entries(textLimits) as [keyof typeof textLimits, number][]) {
    const value = values[key]
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text || text.length > max)
      throw new Error(`Feedback ${key} must be 1–${max} characters.`)
    report[key] = text
  }
  if ([report.title, report.operation, report.failure].some(value => /[\r\n]/.test(value)))
    throw new Error('Feedback title, operation and failure must be single lines.')
  if (values.sourceDigest !== undefined) {
    if (typeof values.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(values.sourceDigest))
      throw new Error('Feedback sourceDigest must be a SHA-256.')
    report.sourceDigest = values.sourceDigest
  }
  return report
}

async function checkSource({ component, source }: Report, checkout: string): Promise<void> {
  if (!/^[a-z][a-z0-9-]*$/.test(component) || !/^[\w.-]+(?:\/[\w.-]+)+$/.test(source)
    || source.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('Use a maintained component and a repository-relative source file.')
  }
  const { localSkillSources } = await loadConfig(checkout)
  const entry = localSkillSources.find(item => item.name === component)
  let directory: string | undefined
  if (entry) {
    const isSkill = entry.kind === 'directory'
    const configured = relative(checkout, join(checkout, isSkill ? entry.path : entry.source)).replaceAll(sep, '/')
    if (configured.startsWith(isSkill ? 'skills/' : 'rules/'))
      directory = isSkill ? configured : dirname(configured)
  }
  const role = source === `agents/${component}/AGENT.md` || source === `agents/${component}/agent.json`
  if (!role && (!directory || !source.startsWith(`${directory}/`)))
    throw new Error('Feedback source is not maintained by this repository.')
  const path = join(checkout, source)
  if (!(await lstatIfPresent(path))?.isFile() || await realpath(path) !== path)
    throw new Error('Feedback source must be an existing checkout-local regular file without symlinks.')
}

function errorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path)
  }
  catch (error) {
    if (!errorCode(error, 'ENOENT'))
      throw error
  }
}

function checkPermissions(info: Stats, disallowedMode: number) {
  if (process.getuid && (info.uid !== process.getuid() || (info.mode & disallowedMode) !== 0))
    throw new Error('Feedback storage must be owned and protected by the current user.')
}

async function ensureDirectory(path: string, create: boolean, disallowedMode = 0o077): Promise<boolean> {
  if (create) {
    await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
      if (!errorCode(error, 'EEXIST'))
        throw error
    })
  }
  const info = await lstatIfPresent(path)
  if (!info?.isDirectory()) {
    if (create)
      throw new Error('Feedback requires checkout-local directories without symlinks.')
    return false
  }
  checkPermissions(info, disallowedMode)
  return true
}

async function feedbackDirectory(checkout: string, create = false): Promise<string | undefined> {
  const local = join(checkout, 'local')
  // Other tools share this parent: it can be readable, but not writable by others.
  if (!await ensureDirectory(local, create, 0o022))
    return
  const directory = join(local, 'skill-feedback')
  if (await ensureDirectory(directory, create))
    return directory
}

async function readOptIn(marker: string): Promise<boolean> {
  if (!(await lstatIfPresent(marker))?.isFile())
    return false
  try {
    const file = await open(marker, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const info = await file.stat()
      if (!info.isFile())
        return false
      checkPermissions(info, 0o077)
      return await file.readFile('utf8') === enabledContents
    }
    finally {
      await file.close()
    }
  }
  catch (error) {
    if (errorCode(error, 'ENOENT') || errorCode(error, 'ELOOP'))
      return false
    throw error
  }
}

async function unlinkIfPresent(path: string): Promise<void> {
  await unlink(path).catch((error: unknown) => {
    if (!errorCode(error, 'ENOENT'))
      throw error
  })
}

async function installFile(path: string, contents: string, beforeLink?: () => Promise<boolean>): Promise<Result['status']> {
  const temporary = join(dirname(path), `.feedback-${randomUUID()}.tmp`)
  const handle = await open(temporary, 'wx', 0o600)
  try {
    try {
      await handle.writeFile(contents)
    }
    finally {
      await handle.close()
    }
    if (beforeLink && !await beforeLink())
      return 'disabled'
    try {
      // Save a complete file without replacing an earlier one, even across processes.
      await link(temporary, path)
    }
    catch (error) {
      if (errorCode(error, 'EEXIST'))
        return 'existing'
      throw error
    }
    return 'saved'
  }
  finally {
    await unlinkIfPresent(temporary)
  }
}

export async function feedbackEnabled(root = repoRoot()): Promise<boolean> {
  const directory = await feedbackDirectory(await realpath(root))
  return directory !== undefined && await readOptIn(join(directory, 'enabled'))
}

export async function setFeedbackEnabled(enabled: boolean, root = repoRoot()): Promise<void> {
  const directory = await feedbackDirectory(await realpath(root), enabled)
  if (!directory)
    return
  const marker = join(directory, 'enabled')
  if ((await lstatIfPresent(marker))?.isDirectory())
    throw new Error('Feedback opt-in marker is a directory; move it out of the way before retrying.')
  if (!enabled) {
    // Remove the marker entry, not the target of a pre-existing symlink.
    await unlinkIfPresent(marker)
    return
  }
  const status = await installFile(marker, enabledContents)
  if (status === 'existing' && !await readOptIn(marker))
    throw new Error('Feedback opt-in is invalid; disable collection before enabling it again.')
}

export async function reportFeedback(input: unknown, root = repoRoot()): Promise<Result> {
  const checkout = await realpath(root)
  const state = await feedbackDirectory(checkout)
  if (!state)
    return { status: 'disabled' }
  const marker = join(state, 'enabled')
  if (!await readOptIn(marker))
    return { status: 'disabled' }
  const report = parseReport(input)
  await checkSource(report, checkout)
  const directory = join(state, 'reports')
  await ensureDirectory(directory, true)
  const signature = [report.component, report.source, report.operation, report.failure]
  const key = createHash('sha256').update(JSON.stringify(signature)).digest('hex')
  const path = join(directory, `${key}.md`)
  const body = [
    `# [${report.component}] ${report.title}`,
    `**Source** — \`${report.source}\``,
    ...(report.sourceDigest ? [`**Reported source SHA-256** — ${report.sourceDigest}`] : []),
    `**Impact** — ${report.impact}`, `**Operation** — ${report.operation}`, `**Observed failure** — ${report.failure}`,
    `## Reproduction\n\n${report.steps}`, `## Cause\n\n${report.cause}`, `## Suggested change\n\n${report.recommendation}`,
  ].join('\n\n') + '\n'
  const status = await installFile(path, body, () => readOptIn(marker))
  if (status === 'disabled')
    return { status }
  if (status === 'existing') {
    const existing = await lstat(path)
    if (!existing.isFile())
      throw new Error('An existing feedback report must be a regular file without symlinks.')
    checkPermissions(existing, 0o077)
  }
  return { status, path }
}
