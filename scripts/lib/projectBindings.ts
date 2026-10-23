import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { alias, type IntegrationBindings, type IntegrationKind, validateBinding } from './integrationContracts.ts'
import { discoverWorkspaceEntries, saveWorkspace } from './projectWorkspaces.ts'
import { repoRoot } from './utils.ts'

export interface BindingOptions {
  root?: string
  workspace?: string
}

export interface ResolvedBinding<K extends IntegrationKind> {
  source: 'workspace' | 'repository' | 'none'
  file: string
  workspace?: string
  member?: string
  resource?: string
  binding?: IntegrationBindings[K]
}

const legacyPaths: Record<IntegrationKind, string[]> = {
  zentao: ['.zentao'], psql: ['.psql'], apifox: ['.apifox', 'projects.json'],
}

export async function readRepositoryBinding<K extends IntegrationKind>(cwd: string, kind: K): Promise<ResolvedBinding<K>> {
  const parts = legacyPaths[kind]
  const file = join(cwd, ...parts)
  for (let index = 1; index <= parts.length; index += 1) {
    try {
      const info = await lstat(join(cwd, ...parts.slice(0, index)))
      if (info.isSymbolicLink() || (index === parts.length ? !info.isFile() : !info.isDirectory()))
        throw new Error('Binding configuration must be a regular file, not a symlink; parent directories must not be symlinks')
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return { source: 'none', file }
      throw error
    }
  }
  let value: unknown
  const source = await readFile(file, 'utf8')
  try { value = JSON.parse(source) }
  catch { throw new Error('Binding configuration is not valid JSON (contents omitted)') }
  return { source: 'repository', file, binding: validateBinding(kind, value) }
}

async function matchingWorkspaces(cwd: string, options: BindingOptions) {
  const discovered = await discoverWorkspaceEntries(cwd, options.root)
  if (discovered.issues.length)
    throw new Error(`Workspace discovery failed; repair the reported map(s) before resolving bindings: ${discovered.issues.map(issue => issue.file).join(', ')}`)
  const matches = options.workspace
    ? discovered.workspaces.filter(entry => entry.name === options.workspace)
    : discovered.workspaces
  if (options.workspace && !matches.length)
    throw new Error('Requested workspace does not contain this repository; no fallback was used')
  return { discovered, matches }
}

export async function resolveProjectBinding<K extends IntegrationKind>(cwd: string, kind: K, options: BindingOptions = {}): Promise<ResolvedBinding<K>> {
  const { discovered, matches } = await matchingWorkspaces(cwd, options)
  const candidates = matches.flatMap(entry => entry.projects
    .filter(project => project.current && project.bindings?.[kind])
    .map(project => ({ entry, member: project.key, resource: project.bindings![kind]! })))
  if (candidates.length > 1)
    throw new Error(`Multiple workspace ${kind} bindings; select --workspace explicitly`)
  if (candidates.length === 1) {
    const candidate = candidates[0]
    const binding = candidate.entry.workspace.resources?.[kind]?.[candidate.resource]
    if (!binding)
      throw new Error('Workspace binding resource is missing; no fallback was used')
    return {
      source: 'workspace', file: candidate.entry.file, workspace: candidate.entry.name,
      member: candidate.member, resource: candidate.resource,
      binding: validateBinding(kind, binding),
    }
  }
  return readRepositoryBinding(discovered.current.root, kind)
}

async function writeProjectBinding<K extends IntegrationKind>(cwd: string, kind: K, resource: string, value: unknown, options: BindingOptions, action: 'save' | 'import') {
  alias(resource)
  const binding = validateBinding(kind, value)
  const { matches } = await matchingWorkspaces(cwd, options)
  if (matches.length !== 1)
    throw new Error(matches.length ? 'Select --workspace explicitly before updating a binding' : 'No registered workspace; run project-init or keep the repository-local workflow')
  const selected = matches[0]
  const members = selected.projects.filter(project => project.current)
  if (members.length !== 1)
    throw new Error('Workspace has ambiguous current members; repair the map first')
  const workspace = selected.workspace
  const expected = JSON.stringify(workspace)
  const member = members[0].key
  if (action === 'import') {
    const group = workspace.resources?.[kind]
    const existing = group && Object.hasOwn(group, resource) ? group[resource] : undefined
    if (existing && !isDeepStrictEqual(validateBinding(kind, existing), binding))
      throw new Error('Import would overwrite a different workspace resource; choose another resource name or update explicitly')
    const bound = workspace.projects[member].bindings?.[kind]
    if (bound && bound !== resource)
      throw new Error('Project already references another resource; update the association explicitly')
  }
  workspace.resources = {
    ...workspace.resources,
    [kind]: { ...workspace.resources?.[kind], [resource]: binding },
  }
  workspace.projects[member].bindings = { ...workspace.projects[member].bindings, [kind]: resource }
  const saved = await saveWorkspace(workspace, { root: options.root ?? repoRoot(), replace: true, expected })
  return {
    ...saved, member, resource, kind,
    affectedMembers: Object.entries(workspace.projects)
      .filter(([, project]) => project.bindings?.[kind] === resource).map(([key]) => key),
  }
}

export async function saveProjectBinding<K extends IntegrationKind>(cwd: string, kind: K, resource: string, value: unknown, options: BindingOptions = {}) {
  return writeProjectBinding(cwd, kind, resource, value, options, 'save')
}

export async function importProjectBinding(cwd: string, kind: IntegrationKind, resource: string, options: BindingOptions = {}) {
  const { discovered, matches } = await matchingWorkspaces(cwd, options)
  if (matches.length !== 1)
    throw new Error('Select one registered workspace before importing a binding')
  const legacy = await readRepositoryBinding(discovered.current.root, kind)
  if (!legacy.binding)
    throw new Error('No repository-local binding exists to import')
  const saved = await writeProjectBinding(cwd, kind, resource, legacy.binding, options, 'import')
  return { ...saved, importedFrom: legacy.file, legacyFileRetained: true }
}
