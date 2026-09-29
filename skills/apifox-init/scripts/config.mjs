import { lstat, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const credentialsPath = () => join(homedir(), '.config', 'apifox-skills', 'credentials.json')
export const manifestPath = root => join(root, '.apifox', 'projects.json')

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`)
}

function keys(value, allowed, label) {
  object(value, label)
  if (Object.keys(value).some(key => !allowed.includes(key)))
    throw new Error(`${label} contains unsupported fields`)
}

export function alias(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(value))
    throw new Error('Aliases must start with a lowercase letter and contain at most 64 letters, digits, underscores or hyphens')
  return value
}

export function serverUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Server must be an absolute HTTP(S) URL') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Server must use HTTP(S) without credentials, query or fragment')
  return url.href.replace(/\/+$/, '')
}

export function validateCredentials(config) {
  keys(config, ['schemaVersion', 'credentials'], 'Credentials file')
  if (config.schemaVersion !== 1) throw new Error('Unsupported credentials schemaVersion')
  object(config.credentials, 'credentials')
  for (const [name, credential] of Object.entries(config.credentials)) {
    alias(name)
    keys(credential, ['server', 'token'], 'Credential')
    serverUrl(credential.server)
    if (typeof credential.token !== 'string' || !credential.token.trim() || /[\r\n\0]/.test(credential.token))
      throw new Error('Credential token must be a non-empty single line')
  }
  return config
}

export function validateManifest(config) {
  keys(config, ['schemaVersion', 'defaultProject', 'projects'], 'Project manifest')
  if (config.schemaVersion !== 1) throw new Error('Unsupported project schemaVersion')
  if (!Array.isArray(config.projects) || !config.projects.length)
    throw new Error('projects must be a non-empty array')
  const names = new Set()
  for (const project of config.projects) {
    keys(project, ['key', 'id', 'name', 'server', 'credential'], 'Project')
    alias(project.key)
    alias(project.credential)
    if (names.has(project.key)) throw new Error('Duplicate project key')
    names.add(project.key)
    if (!Number.isSafeInteger(project.id) || project.id <= 0) throw new Error('Project id must be a positive safe integer')
    if (typeof project.name !== 'string' || !project.name.trim()) throw new Error('Project name is required')
    serverUrl(project.server)
  }
  if (config.defaultProject !== null && !names.has(config.defaultProject))
    throw new Error('defaultProject must be null or an existing project key')
  return config
}

export async function readJson(path, { secret = false } = {}) {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Configuration must be a regular file, not a symlink')
  if (secret && process.platform !== 'win32' && (info.mode & 0o077))
    throw new Error('Credentials file must be private; run chmod 600 on it')
  let config
  try { config = JSON.parse(await readFile(path, 'utf8')) }
  catch { throw new Error('Configuration is not valid JSON (contents omitted)') }
  return secret ? validateCredentials(config) : validateManifest(config)
}

export function selectProject(manifest, requested) {
  validateManifest(manifest)
  const key = requested ?? manifest.defaultProject ?? (manifest.projects.length === 1 ? manifest.projects[0].key : null)
  if (!key) throw new Error('Multiple projects and no default; select a project key explicitly')
  const selected = manifest.projects.find(project => project.key === key)
  if (!selected) throw new Error('Requested project key is not bound; use apifox-init')
  return selected
}

export function selectCredential(config, name, server) {
  validateCredentials(config)
  const credential = Object.hasOwn(config.credentials, name) ? config.credentials[name] : null
  if (!credential) throw new Error('Bound credential is missing locally; configure that alias in your terminal')
  if (server && serverUrl(credential.server) !== serverUrl(server))
    throw new Error('Credential server does not match the project server; refusing to send the token')
  return credential
}
