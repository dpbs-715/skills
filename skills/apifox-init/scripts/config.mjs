import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { alias, serverUrl, validateApifoxBinding } from '../../../scripts/lib/integrationContracts.ts'
import { repoRoot } from '../../../scripts/lib/utils.ts'

export { alias, serverUrl }
export const validateManifest = validateApifoxBinding

export const credentialsPath = (root = repoRoot()) => join(root, 'local', 'apifox', 'credentials.json')
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
