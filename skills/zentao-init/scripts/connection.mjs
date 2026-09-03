#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const requestTimeoutMs = 10_000
const commandTimeoutMs = 30_000
const maxOutputBytes = 16 * 1024 * 1024
const readOptions = new Set([
  '--pick', '--filter', '--sort', '--search', '--search-fields',
  '--page', '--recPerPage', '--limit', '--product', '--project', '--execution',
])
const numericOptions = new Set([
  '--page', '--recPerPage', '--limit', '--product', '--project', '--execution',
])

function normalizeServer(server) {
  if (/[\s\\]/.test(server))
    throw new Error('The ZenTao server HTTP(S) URL must not contain whitespace or backslashes.')
  let url
  try {
    url = new URL(server)
  }
  catch {
    throw new Error('The ZenTao server must be an absolute HTTP(S) URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || url.search || url.hash
      || server.includes('?') || server.includes('#')) {
    throw new Error('The ZenTao server must be an HTTP(S) URL without credentials, query, or fragment.')
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

function parseArguments(args) {
  const [action, ...rest] = args
  if (!['profiles', 'run'].includes(action))
    throw new Error('Usage: connection.mjs profiles [--config path] | run --server URL --profile exact-key [--config path] -- product|project|bug [id/options]')
  const separator = rest.indexOf('--')
  const options = separator < 0 ? rest : rest.slice(0, separator)
  const command = separator < 0 ? [] : rest.slice(separator + 1)
  const parsed = { action, command }
  for (let index = 0; index < options.length; index += 2) {
    const option = options[index]
    const value = options[index + 1]
    if (!['--config', '--server', '--profile'].includes(option)
        || !value?.trim() || value.startsWith('--') || parsed[option.slice(2)] !== undefined)
      throw new Error('Expected unique --config, --server, and --profile options with nonempty values.')
    parsed[option.slice(2)] = value
  }
  if (action === 'profiles') {
    if (parsed.server || parsed.profile || separator >= 0)
      throw new Error('The profiles command only accepts --config.')
  }
  else {
    if (!parsed.server || !parsed.profile)
      throw new Error('A repository server URL and exact profile key are required; run zentao-init first.')
    parsed.server = normalizeServer(parsed.server)
    validateReadCommand(command)
  }
  return parsed
}

function validateReadCommand(command) {
  if (!['product', 'project', 'bug'].includes(command[0]))
    throw new Error('Only product, project, and bug reads are supported.')
  if (command.length === 2 && command[1] === '--help') return
  let index = 1
  if (/^[1-9]\d*$/.test(command[index] ?? '')) index++
  while (index < command.length) {
    const argument = command[index++]
    if (argument === '--all') continue
    const equal = argument.indexOf('=')
    const option = equal < 0 ? argument : argument.slice(0, equal)
    if (!readOptions.has(option))
      throw new Error('Unsupported read argument. Actions and config/auth/request overrides are forbidden.')
    const value = equal < 0 ? command[index++] : argument.slice(equal + 1)
    if (!value || value.startsWith('-') || value.includes('\0'))
      throw new Error('Every read option requires a nonempty value that is not another option.')
    if (numericOptions.has(option) && !/^[1-9]\d*$/.test(value))
      throw new Error('Scope, pagination, and limit options require positive integer values.')
  }
}

function configPath(explicitPath) {
  const configured = explicitPath ?? (process.env.ZENTAO_CONFIG_FILE?.trim() ? process.env.ZENTAO_CONFIG_FILE : undefined)
  if (!configured) return join(homedir(), '.config', 'zentao', 'zentao.json')
  const expanded = configured === '~'
    ? homedir()
    : /^~[/\\]/.test(configured) ? join(homedir(), configured.slice(2)) : configured
  return resolve(expanded)
}

function commandEnvironment() {
  const environment = { ...process.env, NO_COLOR: '1' }
  // CLI 0.2.0 otherwise falls back to these values and may log in automatically.
  for (const key of ['ZENTAO_URL', 'ZENTAO_ACCOUNT', 'ZENTAO_PASSWORD', 'ZENTAO_TOKEN', 'ZENTAO_CONFIG_FILE'])
    delete environment[key]
  return environment
}

function redactDiagnostic(message) {
  return message
    .replace(/(https?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[^\s"',;]+/gi, 'Bearer [redacted]')
    .replace(/((?:["']?)(?:token|access[_-]?token|refresh[_-]?token|password|passwd|authorization|cookie|api[_-]?key|secret|session[_-]?id)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;&}]+)/gi, '$1[redacted]')
    .slice(0, 4_000)
}

function cliFailure(error) {
  const outputs = [error.stderr, error.stdout].filter(output => typeof output === 'string' && output.trim())
  for (const output of outputs) {
    let failure
    try { failure = JSON.parse(output).error }
    catch { continue }
    if (!failure || typeof failure.message !== 'string') continue
    // CLI 0.2.0 formats {error:{code:"1006",message,details?}}, without the E prefix.
    const code = /^E?\d{4}$/.test(String(failure.code)) ? `E${String(failure.code).replace(/^E/, '')}` : undefined
    const diagnosis = redactDiagnostic(failure.message)
    const guidance = code === 'E1006' ? ' No usable saved login; log in to the intended server with zentao login, then retry.' : ''
    return new Error(`ZenTao${code ? ` ${code}` : ''}: ${diagnosis}${guidance}`)
  }
  const output = outputs.join('\n')
  return new Error(output
    ? `ZenTao: ${redactDiagnostic(output)}`
    : `ZenTao command failed (${error.code ?? 'unknown exit status'}).`)
}

async function invokeCli(temporaryConfig, args, signal) {
  try {
    const result = await execFileAsync('zentao', [
      '--config', temporaryConfig, '--format=json', '--machine-readable',
      '--timeout', String(requestTimeoutMs), ...args,
    ], {
      env: commandEnvironment(), timeout: commandTimeoutMs, maxBuffer: maxOutputBytes,
      encoding: 'utf8', killSignal: 'SIGKILL', signal,
    })
    return result.stdout
  }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('zentao CLI is not installed or is not on PATH.')
    if (error.name === 'AbortError') throw new Error('ZenTao request cancelled.')
    if (error.killed) throw new Error('ZenTao command timed out or exceeded its output limit.')
    throw cliFailure(error)
  }
}

function parseJson(output) {
  try {
    return JSON.parse(output)
  }
  catch {
    throw new Error('ZenTao CLI returned invalid JSON; verify the installed CLI version.')
  }
}

async function profileMetadata(temporaryConfig, signal) {
  const result = parseJson(await invokeCli(temporaryConfig, ['profile'], signal))
  if (!result || !Array.isArray(result.profiles) || typeof result.currentProfile !== 'string')
    throw new Error('ZenTao CLI returned an unsupported profile response.')
  const profiles = result.profiles.map(profile => {
    if (!profile || typeof profile.key !== 'string' || typeof profile.server !== 'string'
        || typeof profile.account !== 'string' || profile.key !== `${profile.account}@${profile.server}`)
      throw new Error('ZenTao CLI returned invalid profile metadata.')
    normalizeServer(profile.server)
    return {
      key: profile.key, server: profile.server, account: profile.account,
      current: profile.key === result.currentProfile,
    }
  })
  if (profiles.length === 0)
    throw new Error('No saved login. Log in to the intended server with zentao login, then retry.')
  return { currentProfile: result.currentProfile, profiles }
}

async function run() {
  const options = parseArguments(process.argv.slice(2))
  const directory = await mkdtemp(join(tmpdir(), 'zentao-connection-'))
  const temporaryConfig = join(directory, 'zentao.json')
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.once('SIGINT', cancel)
  process.once('SIGTERM', cancel)
  try {
    await chmod(directory, 0o700)
    try {
      // Keep credentials opaque: only the CLI parses this private copy.
      await copyFile(configPath(options.config), temporaryConfig)
      await chmod(temporaryConfig, 0o600)
    }
    catch (error) {
      if (error.code === 'ENOENT')
        throw new Error('CLI configuration not found. Log in with zentao login or provide the correct --config path.')
      throw new Error('Unable to create a private copy of the CLI configuration.')
    }
    const metadata = await profileMetadata(temporaryConfig, controller.signal)
    if (options.action === 'profiles') return metadata
    const matching = metadata.profiles.filter(profile => profile.key === options.profile)
    if (matching.length !== 1)
      throw new Error('Exact profile key is missing or duplicated. Select an existing full key with zentao-init.')
    if (normalizeServer(matching[0].server) !== options.server)
      throw new Error('The selected profile belongs to a different server than this repository.')
    await invokeCli(temporaryConfig, ['profile', options.profile, '--silent'], controller.signal)
    const selected = await profileMetadata(temporaryConfig, controller.signal)
    const active = selected.profiles.filter(profile => profile.key === selected.currentProfile)
    if (selected.currentProfile !== options.profile || active.length !== 1
        || normalizeServer(active[0].server) !== options.server)
      throw new Error('CLI profile selection did not match the repository connection; no business request was sent.')
    const output = await invokeCli(temporaryConfig, options.command, controller.signal)
    return options.command[1] === '--help' ? { help: output.trim() } : parseJson(output)
  }
  finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
    await rm(directory, { recursive: true, force: true })
  }
}

try {
  console.log(JSON.stringify(await run(), null, 2))
}
catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
