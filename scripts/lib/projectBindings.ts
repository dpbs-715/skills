import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { alias, type IntegrationBindings, type IntegrationKind, type PsqlBinding, resourceNames, validateBinding } from './integrationContracts.ts'
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
  resources?: string[]
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

function combinedPsqlBinding(resources: Record<string, PsqlBinding>, names: string[]): PsqlBinding {
  const services = new Map<string, PsqlBinding['services'][number]>()
  for (const name of names) {
    for (const service of resources[name].services) {
      const previous = services.get(service.name)
      if (previous && !isDeepStrictEqual(previous, service))
        throw new Error(`Conflicting definitions for PostgreSQL service ${service.name}; select --resource explicitly`)
      services.set(service.name, service)
    }
  }
  return { schemaVersion: 1, defaultService: null, services: [...services.values()] }
}

export async function resolveProjectBinding<K extends IntegrationKind>(cwd: string, kind: K, options: BindingOptions & { resource?: string } = {}): Promise<ResolvedBinding<K>> {
  if (options.resource !== undefined && kind !== 'psql')
    throw new Error('--resource selection is only supported for PostgreSQL bindings')
  const { discovered, matches } = await matchingWorkspaces(cwd, options)
  const candidates = matches.flatMap(entry => entry.projects
    .filter(project => project.current && project.bindings?.[kind])
    .map(project => ({ entry, member: project.key, resource: project.bindings![kind]! })))
  if (candidates.length > 1)
    throw new Error(`Multiple workspace ${kind} bindings; select --workspace explicitly`)
  if (candidates.length === 1) {
    const candidate = candidates[0]
    const names = resourceNames(candidate.resource)
    if (options.resource !== undefined && !names.includes(options.resource))
      throw new Error(`Requested PostgreSQL resource is not bound to this project; available: ${names.join(', ')}`)
    const source = {
      source: 'workspace' as const, file: candidate.entry.file, workspace: candidate.entry.name, member: candidate.member,
    }
    const resources = candidate.entry.workspace.resources!
    if (names.length > 1 && options.resource === undefined)
      return { ...source, resources: names, binding: validateBinding(kind, combinedPsqlBinding(resources.psql!, names)) }
    const resource = options.resource ?? names[0]
    return { ...source, resource, binding: resources[kind]![resource] }
  }
  if (options.resource !== undefined)
    throw new Error('No bound workspace PostgreSQL resource to select; no fallback was used')
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
  const bound = workspace.projects[member].bindings?.[kind]
  if (action === 'import') {
    const group = workspace.resources?.[kind]
    const existing = group && Object.hasOwn(group, resource) ? group[resource] : undefined
    if (existing && !isDeepStrictEqual(validateBinding(kind, existing), binding))
      throw new Error('Import would overwrite a different workspace resource; choose another resource name or update explicitly')
    if (bound && !resourceNames(bound).includes(resource))
      throw new Error('Project already references another resource; update the association explicitly')
  }
  workspace.resources = {
    ...workspace.resources,
    [kind]: { ...workspace.resources?.[kind], [resource]: binding },
  }
  const reference = Array.isArray(bound) ? [...new Set([...bound, resource])] : resource
  workspace.projects[member].bindings = { ...workspace.projects[member].bindings, [kind]: reference }
  const saved = await saveWorkspace(workspace, { root: options.root ?? repoRoot(), replace: true, expected })
  return {
    ...saved, member, resource, kind,
    affectedMembers: Object.entries(workspace.projects)
      .filter(([, project]) => resourceNames(project.bindings?.[kind]).includes(resource)).map(([key]) => key),
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
