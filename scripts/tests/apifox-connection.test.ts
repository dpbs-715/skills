import assert from 'node:assert/strict'
import { execFile, spawnSync } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const helper = fileURLToPath(new URL('../../skills/apifox-init/scripts/connection.mjs', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/apifox-cli.mjs', import.meta.url))
const serverA = 'https://a.example.test/api'
const serverB = 'https://b.example.test/api'

async function setup(t: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'apifox-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const bin = join(root, 'bin')
  await mkdir(bin)
  await copyFile(fixture, join(bin, 'apifox'))
  await chmod(join(bin, 'apifox'), 0o700)
  const credentials = join(root, 'credentials.json')
  const source = JSON.stringify({ schemaVersion: 1, credentials: {
    a: { server: serverA, token: 'secret-A-for-tests' },
    b: { server: serverB, token: 'secret-B-for-tests' },
  } })
  await writeFile(credentials, source, { mode: 0o600 })
  const manifest = { schemaVersion: 1, defaultProject: null as string | null, projects: [
    { key: 'first', id: 7, name: 'First', server: serverA, credential: 'a' },
    { key: 'second', id: 7, name: 'Second', server: serverB, credential: 'b' },
  ] }
  await mkdir(join(root, '.apifox'))
  const file = join(root, '.apifox', 'projects.json')
  const nativeFile = join(root, '.apifox', 'settings.json')
  const native = '{"projectId":999}\n'
  await writeFile(nativeFile, native)
  await writeFile(file, JSON.stringify(manifest))
  const log = join(root, 'calls.jsonl')
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_APIFOX_LOG: log }
  const run = (args: string[]) => exec(process.execPath, [helper, ...args, '--credentials', credentials], { env, timeout: 10_000 })
  const invoke = (args: string[], command: string[]) => exec(process.execPath,
    [helper, ...args, '--credentials', credentials, '--', ...command], { env, timeout: 10_000 })
  const bind = () => writeFile(file, JSON.stringify(manifest))
  const calls = async () => {
    try { return (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line)) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  return { root, credentials, source, manifest, file, nativeFile, native, run, invoke, bind, calls, env }
}

test('routes concurrent equal project IDs to distinct servers/tokens without changing configuration', async t => {
  const c = await setup(t)
  const results = await Promise.all(['first', 'second'].map(key => c.invoke(['run', '--root', c.root, '--project', key], ['endpoint', 'list'])))
  assert.deepEqual(results.map(result => JSON.parse(result.stdout)), [
    { command: ['endpoint', 'list'], project: '7', server: serverA, credential: 'a' },
    { command: ['endpoint', 'list'], project: '7', server: serverB, credential: 'b' },
  ])
  assert.equal(await readFile(c.credentials, 'utf8'), c.source)
  assert.equal(await readFile(c.nativeFile, 'utf8'), c.native)
})

test('requires an unambiguous binding and never falls back from an unknown key', async t => {
  const c = await setup(t)
  await assert.rejects(c.invoke(['run', '--root', c.root], ['endpoint', 'list']), /Multiple projects/)
  c.manifest.defaultProject = 'first'
  await c.bind()
  assert.equal(JSON.parse((await c.invoke(['run', '--root', c.root], ['endpoint', 'list'])).stdout).credential, 'a')
  await assert.rejects(c.invoke(['run', '--root', c.root, '--project', 'missing'], ['endpoint', 'list']), /not bound/)
  c.manifest.defaultProject = null
  c.manifest.projects.pop()
  await c.bind()
  assert.equal(JSON.parse((await c.invoke(['run', '--root', c.root], ['endpoint', 'list'])).stdout).project, '7')
})

test('supports one credential for many projects and different tokens for the same server/project', async t => {
  const c = await setup(t)
  c.manifest.projects[1] = { ...c.manifest.projects[1], id: 8, server: serverA, credential: 'a' }
  await c.bind()
  assert.equal(JSON.parse((await c.invoke(['run', '--root', c.root, '--project', 'second'], ['endpoint', 'list'])).stdout).project, '8')
  const config = JSON.parse(c.source)
  config.credentials.b.server = serverA
  await writeFile(c.credentials, JSON.stringify(config))
  c.manifest.projects[1] = { ...c.manifest.projects[1], id: 7, credential: 'b' }
  await c.bind()
  assert.equal(JSON.parse((await c.invoke(['run', '--root', c.root, '--project', 'second'], ['endpoint', 'list'])).stdout).credential, 'b')
})

test('rejects missing credentials, server mismatches and explicit connection overrides before executing', async t => {
  const c = await setup(t)
  const args = ['run', '--root', c.root, '--project', 'first']
  for (const extra of [['--access-token=another'], ['--api-base-url', serverB], ['--project', '99'], ['--']])
    await assert.rejects(c.invoke(args, ['endpoint', 'list', ...extra]), /overrides/)
  c.manifest.projects[0].credential = 'missing'
  await c.bind()
  await assert.rejects(c.invoke(args, ['endpoint', 'list']), /missing locally/)
  c.manifest.projects[0].credential = 'b'
  await c.bind()
  await assert.rejects(c.invoke(args, ['endpoint', 'list']), /does not match/)
  assert.deepEqual(await c.calls(), [])
})

test('discovery is read-only and bound project get cannot target another project', async t => {
  const c = await setup(t)
  await c.invoke(['discover', '--credential', 'b'], ['project', 'list'])
  await assert.rejects(c.invoke(['discover', '--credential', 'b'], ['project', 'create']), /outside/)
  await assert.rejects(c.invoke(['run', '--root', c.root, '--project', 'first'], ['project', 'get', '99']), /outside/)
  const result = await c.invoke(['run', '--root', c.root, '--project', 'first'], ['project', 'get', '7'])
  assert.equal(JSON.parse(result.stdout).project, null)
  assert.equal(JSON.parse(result.stdout).credential, 'a')
})

test('lists safe metadata, reports missing bindings, and redacts tokens from success and failure', async t => {
  const c = await setup(t)
  const metadata = (await c.run(['credentials'])).stdout
  assert.ok(!metadata.includes('secret-'))
  assert.ok(!metadata.includes('token'))
  c.manifest.projects[1].credential = 'missing'
  await c.bind()
  assert.match((await c.run(['inspect', '--root', c.root])).stdout, /missing locally/)
  const args = ['run', '--root', c.root, '--project', 'first']
  assert.equal((await c.invoke(args, ['endpoint', 'list', '--echo-token'])).stdout, '[REDACTED]')
  await assert.rejects(c.invoke(args, ['endpoint', 'list', '--fail']), error => {
    const failure = error as Error & { code: number, stderr: string }
    assert.equal(failure.code, 2)
    assert.ok(!failure.stderr.includes('secret-'))
    assert.match(failure.stderr, /REDACTED/)
    return true
  })
})

test('rejects malformed, unsupported, ambiguous and symlinked manifests', async t => {
  const c = await setup(t)
  const args = ['run', '--root', c.root, '--project', 'first']
  await writeFile(c.file, '{"token":"do-not-print-me"')
  await assert.rejects(c.invoke(args, ['endpoint', 'list']), error => {
    assert.ok(!(error as Error).message.includes('do-not-print-me'))
    return true
  })
  await writeFile(c.file, JSON.stringify({ ...c.manifest, schemaVersion: 999 }))
  await assert.rejects(c.invoke(args, ['endpoint', 'list']), /schemaVersion/)
  c.manifest.projects[1].key = 'first'
  await c.bind()
  await assert.rejects(c.invoke(args, ['endpoint', 'list']), /Duplicate/)
  await rm(c.file)
  await symlink(c.credentials, c.file)
  await assert.rejects(c.invoke(args, ['endpoint', 'list']), /regular file/)
  assert.deepEqual(await c.calls(), [])
})

test('credential-set accepts stdin, preserves other aliases, and writes a private store', async t => {
  const c = await setup(t)
  const result = spawnSync(process.execPath, [helper, 'credential-set', '--credential', 'third', '--server', serverA, '--credentials', c.credentials], {
    env: c.env, input: 'third-secret\n', encoding: 'utf8', timeout: 10_000,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(!result.stdout.includes('third-secret'))
  const stored = JSON.parse(await readFile(c.credentials, 'utf8'))
  assert.equal(stored.credentials.a.token, 'secret-A-for-tests')
  assert.equal(stored.credentials.third.token, 'third-secret')
  assert.equal((await stat(c.credentials)).mode & 0o777, 0o600)
  await chmod(c.credentials, 0o644)
  await assert.rejects(c.run(['credentials']), /private/)
})
