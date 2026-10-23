export const integrationKinds = ['zentao', 'psql', 'apifox'] as const
export type IntegrationKind = typeof integrationKinds[number]

export interface ZenTaoBinding {
  schemaVersion: 2
  server: string
  product: { id: number, name: string } | null
  project: { id: number, name: string }
}

export interface PsqlBinding {
  schemaVersion: 1
  defaultService: string | null
  services: Array<{ name: string, dbname: string, [key: string]: unknown }>
}

export interface ApifoxBinding {
  schemaVersion: 1
  defaultProject: string | null
  projects: Array<{ key: string, id: number, name: string, server: string, credential: string }>
}

export interface IntegrationBindings {
  zentao: ZenTaoBinding
  psql: PsqlBinding
  apifox: ApifoxBinding
}

export type WorkspaceResources = { [K in IntegrationKind]?: Record<string, IntegrationBindings[K]> }
export type ProjectBindings = Partial<Record<IntegrationKind, string>>

export function integrationKind(value: string): IntegrationKind {
  if (!(integrationKinds as readonly string[]).includes(value))
    throw new Error('Integration must be zentao, psql or apifox')
  return value as IntegrationKind
}

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

export function keys(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  const record = object(value, label)
  if (Object.keys(record).some(key => !allowed.includes(key)))
    throw new Error(`${label} contains unsupported fields`)
  return record
}

export function nonempty(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
    throw new Error(`${label} must be a non-empty string without control characters`)
  return value
}

export function alias(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(value))
    throw new Error('Aliases must start with a lowercase letter and contain at most 64 letters, digits, underscores or hyphens')
  return value
}

export function serverUrl(value: unknown): string {
  if (typeof value !== 'string' || /[\s\\?#]/.test(value))
    throw new Error('Server must be an absolute HTTP(S) URL without credentials, query or fragment')
  let url: URL
  try { url = new URL(value) }
  catch { throw new Error('Server must be an absolute HTTP(S) URL') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Server must use HTTP(S) without credentials, query or fragment')
  return url.href.replace(/\/+$/, '')
}

function entity(value: unknown): { id: number, name: string } {
  const item = keys(value, ['id', 'name'], 'ZenTao object')
  if (!Number.isSafeInteger(item.id) || (item.id as number) <= 0)
    throw new Error('ZenTao object id must be a positive safe integer')
  return { id: item.id as number, name: nonempty(item.name, 'ZenTao object name') }
}

export function validateZenTaoBinding(value: unknown): ZenTaoBinding {
  const config = keys(value, ['schemaVersion', 'server', 'product', 'project'], 'ZenTao binding')
  if (config.schemaVersion !== 2)
    throw new Error('ZenTao binding requires schemaVersion 2; use zentao-init to migrate')
  return { schemaVersion: 2, server: serverUrl(config.server), product: config.product === null ? null : entity(config.product), project: entity(config.project) }
}

export function validateApifoxBinding(value: unknown): ApifoxBinding {
  const config = keys(value, ['schemaVersion', 'defaultProject', 'projects'], 'Project manifest')
  if (config.schemaVersion !== 1) throw new Error('Unsupported project schemaVersion')
  if (!Array.isArray(config.projects) || !config.projects.length)
    throw new Error('projects must be a non-empty array')
  const names = new Set<string>()
  const projects = config.projects.map(raw => {
    const project = keys(raw, ['key', 'id', 'name', 'server', 'credential'], 'Project')
    const key = alias(project.key)
    if (names.has(key)) throw new Error('Duplicate project key')
    names.add(key)
    if (!Number.isSafeInteger(project.id) || (project.id as number) <= 0)
      throw new Error('Project id must be a positive safe integer')
    return {
      key, id: project.id as number, name: nonempty(project.name, 'Project name'),
      server: serverUrl(project.server), credential: alias(project.credential),
    }
  })
  if (config.defaultProject !== null && !names.has(config.defaultProject as string))
    throw new Error('defaultProject must be null or an existing project key')
  return { schemaVersion: 1, defaultProject: config.defaultProject as string | null, projects }
}

// Service metadata is descriptive only; connection routing remains in libpq.
function psqlMetadata(value: unknown): void {
  if (typeof value === 'string' && (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /(?:^|\s)(?:host|port|user|password|service)\s*=/i.test(value)))
    throw new Error('PostgreSQL metadata must not contain connection URLs or parameters')
  if (Array.isArray(value)) {
    value.forEach(psqlMetadata)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (['host', 'hostname', 'hostaddr', 'address', 'port', 'account', 'user', 'username', 'password', 'passwd', 'secret', 'token', 'credential', 'credentials', 'url', 'uri', 'connection', 'connectionstring', 'dsn'].includes(key.replace(/[_-]/g, '').toLowerCase()))
        throw new Error('PostgreSQL binding must not contain connection fields or credentials')
      psqlMetadata(entry)
    }
  }
}

export function validatePsqlBinding(value: unknown): PsqlBinding {
  const config = keys(value, ['schemaVersion', 'defaultService', 'services'], 'PostgreSQL binding')
  if (config.schemaVersion !== 1) throw new Error('Unsupported PostgreSQL schemaVersion')
  if (!Array.isArray(config.services) || !config.services.length)
    throw new Error('services must be a non-empty array')
  const names = new Set<string>()
  const services = config.services.map(raw => {
    const entry = object(raw, 'PostgreSQL service')
    const name = nonempty(entry.name, 'Service name')
    const dbname = nonempty(entry.dbname, 'Database name')
    if (names.has(name)) throw new Error('Duplicate PostgreSQL service name')
    names.add(name)
    const metadata = Object.fromEntries(Object.entries(entry).filter(([key]) => !['name', 'dbname'].includes(key)))
    psqlMetadata({ ...metadata, name, dbname })
    return { ...metadata, name, dbname }
  })
  if (config.defaultService !== null && !names.has(config.defaultService as string))
    throw new Error('defaultService must be null or an existing service name')
  return { schemaVersion: 1, defaultService: config.defaultService as string | null, services }
}

export function validateBinding<K extends IntegrationKind>(kind: K, value: unknown): IntegrationBindings[K] {
  const validators = { zentao: validateZenTaoBinding, psql: validatePsqlBinding, apifox: validateApifoxBinding }
  return validators[kind](value) as IntegrationBindings[K]
}

export function validateResources(value: unknown): WorkspaceResources {
  const input = keys(value, integrationKinds, 'Workspace resources')
  return Object.fromEntries(Object.entries(input).map(([kind, raw]) => [kind,
    Object.fromEntries(Object.entries(object(raw, `${kind} resources`)).map(([name, binding]) => [alias(name), validateBinding(integrationKind(kind), binding)])),
  ])) as WorkspaceResources
}

export function validateProjectBindings(value: unknown): ProjectBindings {
  const input = keys(value, integrationKinds, 'Project bindings')
  return Object.fromEntries(Object.entries(input).map(([kind, name]) => [kind, alias(name)]))
}
