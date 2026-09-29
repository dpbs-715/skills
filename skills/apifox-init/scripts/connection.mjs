#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { chmod, lstat, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { alias, credentialsPath, manifestPath, readJson, selectCredential, selectProject, serverUrl, validateCredentials } from './config.mjs'

const execute = promisify(execFile)
const scopedResources = new Set([
  'endpoint', 'schema', 'folder', 'module', 'mock', 'common-parameter', 'response-component',
  'security-scheme', 'environment', 'variables', 'import', 'export', 'doc', 'docs-site',
  'shared-doc', 'test-case', 'test-data', 'test-scenario', 'test-suite', 'test-report',
  'debug-case', 'run', 'runner', 'scheduled-task', 'branch', 'merge-request',
])

function redact(text, secrets) {
  for (const token of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
    for (const form of new Set([token, encodeURIComponent(token), JSON.stringify(token).slice(1, -1)]))
      text = text.replaceAll(form, '[REDACTED]')
  return text
}

export function commandArgs(args, credential, project) {
  if (!args.length || args.includes('--') || args.some(arg => /^(--access-token|--api-base-url|--project)(=|$)/.test(arg)))
    throw new Error('Pass a command without token, server or project overrides; the helper supplies them')
  const [resource, operation] = args
  const discovery = !project && resource === 'project' && ['list', 'get'].includes(operation)
  const projectRead = project && resource === 'project' && operation === 'get' && args[2] === String(project.id)
  const schemaRead = resource === 'cli-schema' && ['list', 'get', 'validate'].includes(operation)
  if (!discovery && !projectRead && !schemaRead && !(project && scopedResources.has(resource)))
    throw new Error('Command is outside the helper scope; use project list/get for discovery or a supported project resource')
  return [
    ...args,
    ...(!discovery && !projectRead && !schemaRead ? ['--project', String(project.id)] : []),
    '--api-base-url', serverUrl(credential.server), '--access-token', credential.token,
  ]
}

export async function runCli(args, credential, project, { cwd, secrets = [credential.token] } = {}) {
  const command = commandArgs(args, credential, project)
  try {
    const result = await execute('apifox', command, {
      cwd, encoding: 'utf8', timeout: 600_000, maxBuffer: 16 * 1024 * 1024,
    })
    return { code: 0, stdout: redact(result.stdout, secrets), stderr: redact(result.stderr, secrets) }
  }
  catch (error) {
    // execFile's message includes argv (and therefore the token); never emit it.
    const code = typeof error.code === 'number' && error.code > 0 ? error.code : 1
    const reason = error.code === 'ENOENT' ? 'Apifox CLI is not installed or not on PATH' : 'Apifox CLI failed or timed out; check the sanitized output'
    return { code, stdout: redact(error.stdout || '', secrets), stderr: `${redact(error.stderr || '', secrets)}\n${reason}\n` }
  }
}

function parseOptions(args) {
  const result = {}
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]
    if (!['--root', '--project', '--credential', '--credentials', '--server'].includes(name) || !args[i + 1] || Object.hasOwn(result, name.slice(2)))
      throw new Error('Invalid or duplicate helper option')
    result[name.slice(2)] = args[i + 1]
  }
  return result
}

async function rootDirectory(explicit) {
  if (explicit) return resolve(explicit)
  try { return (await execute('git', ['rev-parse', '--show-toplevel'])).stdout.trim() }
  catch { throw new Error('Not in a Git repository; confirm a directory and pass --root explicitly') }
}

async function readToken() {
  if (!process.stdin.isTTY) {
    let token = ''
    for await (const chunk of process.stdin) token += chunk
    return token.trim()
  }
  const output = new Writable({ write(_chunk, _encoding, callback) { callback() } })
  const reader = createInterface({ input: process.stdin, output, terminal: true })
  process.stderr.write('Apifox token (hidden): ')
  try { return (await reader.question('')).trim() }
  finally { reader.close(); process.stderr.write('\n') }
}

async function saveCredential(path, name, server) {
  alias(name)
  server = serverUrl(server)
  const parent = dirname(path)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  if ((await lstat(parent)).isSymbolicLink()) throw new Error('Credentials directory cannot be a symlink')
  const lock = `${path}.lock`
  const handle = await open(lock, 'wx', 0o600)
  const temporary = `${lock}.tmp`
  try {
    let config
    try { config = await readJson(path, { secret: true }) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      config = { schemaVersion: 1, credentials: {} }
    }
    const token = await readToken()
    config.credentials[name] = { server, token }
    validateCredentials(config)
    const output = await open(temporary, 'wx', 0o600)
    try { await output.writeFile(`${JSON.stringify(config, null, 2)}\n`) }
    finally { await output.close() }
    await rename(temporary, path)
    await chmod(path, 0o600)
    console.log(JSON.stringify({ saved: name, server }))
  }
  finally {
    await handle.close()
    await rm(temporary, { force: true })
    await rm(lock, { force: true })
  }
}

export async function main(args) {
  const [mode, ...rest] = args
  if (!mode || mode === '--help') {
    console.log(`Apifox connection helper
  credentials                              List credential aliases and servers (no tokens)
  credential-set --credential <alias> --server <url>
                                           Read token from a hidden terminal prompt or stdin
  inspect [--root <directory>]             Inspect project bindings and local credential availability
  discover --credential <alias> -- project list|get <id>
  run [--root <directory>] [--project <key>] -- <apifox command>
All modes accept --credentials <private-file> for an explicit local credential store.
The repository manifest is .apifox/projects.json. No global CLI account is switched.`)
    return
  }
  const separator = rest.indexOf('--')
  const options = parseOptions(separator < 0 ? rest : rest.slice(0, separator))
  const command = separator < 0 ? [] : rest.slice(separator + 1)
  const path = resolve(options.credentials ?? credentialsPath())
  if (mode === 'credential-set') {
    if (!options.credential || !options.server) throw new Error('credential-set requires --credential and --server')
    await saveCredential(path, options.credential, options.server)
    return
  }
  let config
  try { config = await readJson(path, { secret: true }) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    config = { schemaVersion: 1, credentials: {} }
  }
  if (mode === 'credentials') {
    console.log(JSON.stringify({ credentials: Object.entries(config.credentials).map(([name, credential]) => ({ name, server: serverUrl(credential.server) })) }, null, 2))
    return
  }
  const secrets = Object.values(config.credentials).map(credential => credential.token)
  if (mode === 'discover') {
    const credential = selectCredential(config, options.credential)
    const result = await runCli(command, credential, undefined, { secrets })
    process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.code
    return
  }
  if (!['inspect', 'run'].includes(mode)) throw new Error('Unknown helper mode')
  const root = await rootDirectory(options.root)
  const manifest = await readJson(manifestPath(root))
  if (mode === 'inspect') {
    console.log(JSON.stringify({ ...manifest, projects: manifest.projects.map(project => {
      let status = 'configured; connectivity untested'
      try { selectCredential(config, project.credential, project.server) }
      catch (error) { status = error.message }
      return { ...project, status }
    }) }, null, 2))
    return
  }
  if (options.credential || options.server) throw new Error('run uses the bound credential and server; update the binding with apifox-init')
  const project = selectProject(manifest, options.project)
  const credential = selectCredential(config, project.credential, project.server)
  const result = await runCli(command, credential, project, { cwd: root, secrets })
  process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.code
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    // Parsing errors never include source file contents or credential values.
    console.error(error.code === 'ENOENT' ? 'Configuration file is missing; run apifox-init' : error.message)
    process.exitCode = 1
  })
}
