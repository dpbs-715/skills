import { execFile } from 'node:child_process'
import { link, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import process from 'node:process'

import { parse, stringify } from 'yaml'

import { homePath } from './symlink.ts'
import { type ProjectBindings, type WorkspaceResources, validateProjectBindings, validateResources } from './integrationContracts.ts'
import { pathExists, repoRoot } from './utils.ts'

const execFileAsync = promisify(execFile)
const identifier = /^[a-z0-9][a-z0-9_-]*$/

export interface WorkspaceProject {
  path: string
  description?: string
  uses?: string[]
  bindings?: ProjectBindings
}

export interface ProjectWorkspace {
  name: string
  description?: string
  projects: Record<string, WorkspaceProject>
  resources?: WorkspaceResources
}

interface WorkspaceEntry {
  file: string
  workspace: ProjectWorkspace
}

interface WorkspaceIssue {
  file: string
  message: string
}

export function workspaceDirectory(root = repoRoot()): string {
  return join(root, 'local', 'project-workspaces')
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be a mapping`)
  return value as Record<string, unknown>
}

function fields(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      throw new Error(`Unknown ${label} field: ${key}`)
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${label} must be a non-empty string`)
  return value
}

export function validateWorkspace(value: unknown): ProjectWorkspace {
  const input = object(value, 'Workspace')
  fields(input, ['name', 'description', 'projects', 'resources'], 'workspace')
  const resources = input.resources === undefined ? undefined : validateResources(input.resources)
  const name = text(input.name, 'Workspace name')
  if (!identifier.test(name))
    throw new Error('Workspace name must contain lowercase letters, digits, hyphens or underscores')
  const description = input.description === undefined ? undefined : text(input.description, 'Workspace description')
  const entries = Object.entries(object(input.projects, 'Projects'))
  if (entries.length === 0)
    throw new Error('Workspace must contain at least one project')

  const projects: Record<string, WorkspaceProject> = Object.fromEntries(entries.map(([key, raw]) => {
    if (!identifier.test(key))
      throw new Error(`Invalid project key: ${key}`)
    const project = object(raw, `Project ${key}`)
    fields(project, ['path', 'description', 'uses', 'bindings'], `project ${key}`)
    const path = homePath(text(project.path, `Project ${key} path`))
    if (!isAbsolute(path))
      throw new Error(`Project ${key} path must be absolute or start with ~/`)
    const result: WorkspaceProject = { path: resolve(path) }
    if (project.bindings !== undefined) {
      result.bindings = validateProjectBindings(project.bindings)
      for (const [kind, resource] of Object.entries(result.bindings)) {
        const entries = resources?.[kind as keyof WorkspaceResources]
        if (!entries || !Object.hasOwn(entries, resource))
          throw new Error(`Project ${key} references a missing ${kind} resource`)
      }
    }
    if (project.description !== undefined)
      result.description = text(project.description, `Project ${key} description`)
    if (project.uses !== undefined) {
      if (!Array.isArray(project.uses) || project.uses.some(dependency => typeof dependency !== 'string'))
        throw new Error(`Project ${key} uses must be an array of project keys`)
      result.uses = [...new Set(project.uses as string[])]
    }
    return [key, result]
  }))
  for (const [key, project] of Object.entries(projects)) {
    for (const dependency of project.uses ?? []) {
      if (!Object.hasOwn(projects, dependency) || dependency === key)
        throw new Error(`Project ${key} has an invalid dependency: ${dependency}`)
    }
  }
  return { name, ...(description === undefined ? {} : { description }), projects, ...(resources ? { resources } : {}) }
}

export function parseWorkspace(source: string): ProjectWorkspace {
  return validateWorkspace(parse(source, { uniqueKeys: true, maxAliasCount: 20 }))
}

export async function listWorkspaces(root = repoRoot()): Promise<{ workspaces: WorkspaceEntry[], issues: WorkspaceIssue[] }> {
  const directory = workspaceDirectory(root)
  if (!await pathExists(directory))
    return { workspaces: [], issues: [] }
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map(entry => join(directory, entry.name)).sort()
  const workspaces: WorkspaceEntry[] = []
  const issues: WorkspaceIssue[] = []
  const names = new Set<string>()
  for (const file of files) {
    try {
      const workspace = parseWorkspace(await readFile(file, 'utf8'))
      if (names.has(workspace.name))
        throw new Error(`Duplicate workspace name: ${workspace.name}`)
      names.add(workspace.name)
      workspaces.push({ file, workspace })
    }
    catch (error) {
      issues.push({ file, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { workspaces, issues }
}

async function gitPath(directory: string, args: string[]): Promise<string | undefined> {
  let output: string
  try {
    const { stdout } = await execFileAsync('git', ['-C', directory, 'rev-parse', ...args], {
      timeout: 5000, env: { ...process.env, LC_ALL: 'C' },
    })
    output = stdout.trim()
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new Error('Git is required for project identity discovery', { cause: error })
    if (error instanceof Error && 'code' in error && error.code === 128
      && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.includes('not a git repository'))
      return undefined
    throw new Error('Git identity lookup failed; verify repository access before retrying', { cause: error })
  }
  return realpath(output)
}

export async function projectIdentity(path: string): Promise<{ root: string, commonDirectory?: string }> {
  const directory = await realpath(homePath(path))
  if (!(await stat(directory)).isDirectory())
    throw new Error(`Project path is not a directory: ${path}`)
  const gitRoot = await gitPath(directory, ['--show-toplevel'])
  const commonDirectory = gitRoot ? await gitPath(directory, ['--path-format=absolute', '--git-common-dir']) : undefined
  return { root: gitRoot ?? directory, ...(commonDirectory ? { commonDirectory } : {}) }
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

export async function discoverWorkspaceEntries(cwd: string, root = repoRoot()) {
  const current = await projectIdentity(cwd)
  const { workspaces, issues } = await listWorkspaces(root)
  const matches = []
  for (const entry of workspaces) {
    const projects = []
    for (const [key, project] of Object.entries(entry.workspace.projects)) {
      try {
        const identity = await projectIdentity(project.path)
        const sameRepository = Boolean(current.commonDirectory && current.commonDirectory === identity.commonDirectory)
        const isCurrent = sameRepository || (current.root === identity.root)
          || (!current.commonDirectory && !identity.commonDirectory && contains(identity.root, current.root))
        projects.push({
          key, ...project, available: true, current: isCurrent,
          // Worktrees share identity, but the active checkout must keep its own rules and branch.
          path: isCurrent ? current.root : identity.root,
          registeredPath: project.path,
        })
      }
      catch (error) {
        projects.push({
          key, ...project, available: false, current: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    if (projects.some(project => project.current))
      matches.push({ file: entry.file, name: entry.workspace.name, description: entry.workspace.description, projects, workspace: entry.workspace })
  }
  return { current, workspaces: matches, issues }
}

export async function discoverWorkspaces(cwd: string, root = repoRoot()) {
  const result = await discoverWorkspaceEntries(cwd, root)
  return {
    ...result,
    workspaces: result.workspaces.map(entry => ({
      file: entry.file, name: entry.name, description: entry.description, projects: entry.projects,
    })),
  }
}

const projectResources = {
  instructions: ['AGENTS.override.md', 'AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md', '.claude/CLAUDE.md', '.claude/AGENTS.md'],
  rules: ['.claude/rules', '.codex/rules', '.pi/rules'],
  skills: ['.agents/skills', '.claude/skills', '.codex/skills', '.pi/skills'],
  agents: ['.claude/agents', '.codex/agents', '.pi/agents', '.agents/agents'],
  mcp: ['.mcp.json', '.codex/config.toml', '.pi/mcp.json'],
  serena: ['.serena/project.yml', '.serena/project.local.yml'],
}

export async function inspectProject(path: string) {
  const identity = await projectIdentity(path)
  const resources: Record<string, string[]> = {}
  for (const [kind, candidates] of Object.entries(projectResources)) {
    resources[kind] = []
    for (const candidate of candidates) {
      const resource = join(identity.root, candidate)
      if (await pathExists(resource))
        resources[kind].push(resource)
    }
  }
  return { ...identity, resources, toolStatus: 'configuration-discovered-only' as const }
}

export async function saveWorkspace(value: unknown, { root = repoRoot(), replace = false, expected }: { root?: string, replace?: boolean, expected?: string } = {}) {
  const workspace = validateWorkspace(value)
  const directory = workspaceDirectory(root)
  const file = join(directory, `${workspace.name}.yaml`)
  const catalog = await listWorkspaces(root)
  const existing = catalog.workspaces.find(entry => entry.workspace.name === workspace.name)
  if (existing && existing.file !== file)
    throw new Error(`Workspace already exists at ${existing.file}; edit that map explicitly`)
  const original = replace ? await readFile(file, 'utf8') : undefined
  const previous = original === undefined ? undefined : parseWorkspace(original)
  if (previous && previous.name !== workspace.name)
    throw new Error(`Workspace name mismatch in ${file}`)
  if (expected !== undefined && JSON.stringify(previous) !== expected)
    throw new Error('Workspace changed; reload it before retrying the update')

  const identities = new Set<string>()
  for (const [key, project] of Object.entries(workspace.projects)) {
    let identity: Awaited<ReturnType<typeof projectIdentity>>
    try {
      identity = await projectIdentity(project.path)
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT'
        && previous?.projects[key]?.path === project.path)
        continue
      throw error
    }
    project.path = identity.root
    const id = identity.commonDirectory ?? identity.root
    if (identities.has(id))
      throw new Error(`Project ${key} duplicates another repository or worktree in this workspace`)
    identities.add(id)
  }
  await mkdir(directory, { recursive: true })
  const lockFile = `${file}.lock`
  const lock = await open(lockFile, 'wx', 0o600)
  const temporary = join(directory, `.${workspace.name}-${randomUUID()}.tmp`)
  try {
    if (replace && await readFile(file, 'utf8') !== original)
      throw new Error('Workspace changed; reload it before retrying the update')
    await writeFile(temporary, stringify(workspace), { flag: 'wx', mode: 0o600 })
    if (replace)
      await rename(temporary, file)
    else
      await link(temporary, file)
  }
  finally {
    await rm(temporary, { force: true })
    await lock.close()
    await rm(lockFile, { force: true })
  }
  return { file, workspace: parseWorkspace(await readFile(file, 'utf8')) }
}
