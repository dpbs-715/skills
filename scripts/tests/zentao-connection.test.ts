import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const helper = fileURLToPath(new URL('../../skills/zentao-init/scripts/connection.mjs', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/zentao-cli.mjs', import.meta.url))
const serverA = 'https://a.example.test/zentao'
const serverB = 'https://b.example.test/zentao'
const profileA = `alice@${serverA}`
const profileB = `bob@${serverB}`

async function setup(t: { after: (cleanup: () => Promise<void>) => void }, login: 'saved' | 'empty' | 'missing-token' = 'saved') {
  const directory = await mkdtemp(join(tmpdir(), 'zentao-connection-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const bin = join(directory, 'bin')
  await mkdir(bin)
  await copyFile(fixture, join(bin, 'zentao'))
  await chmod(join(bin, 'zentao'), 0o700)
  const config = join(directory, 'source.json')
  const log = join(directory, 'calls.jsonl')
  const source = JSON.stringify({
    currentProfile: profileA,
    profiles: login === 'empty' ? [] : [
      { key: profileA, server: serverA, account: 'alice', token: login === 'saved' ? 'imaginary-secret-token' : undefined },
      { key: profileB, server: serverB, account: 'bob', token: login === 'saved' ? 'imaginary-secret-token' : undefined },
    ],
    unknownFutureField: { keep: true },
  })
  await writeFile(config, source)
  const env = {
    ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_ZENTAO_LOG: log,
    ZENTAO_CONFIG_FILE: config, ZENTAO_URL: 'https://unrelated.example.test',
    ZENTAO_ACCOUNT: 'unrelated', ZENTAO_PASSWORD: 'imaginary-password', ZENTAO_TOKEN: 'imaginary-token',
  }
  const execute = (args: string[], overrides: NodeJS.ProcessEnv = {}) => execFileAsync(process.execPath, [helper, ...args], {
    env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10_000,
  })
  const calls = async (): Promise<{ path: string, command: string[] }[]> => {
    try {
      return (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }
  const checkCleanup = async () => {
    assert.equal(await readFile(config, 'utf8'), source)
    for (const call of await calls())
      await assert.rejects(access(dirname(call.path)), { code: 'ENOENT' })
  }
  return { config, execute, calls, checkCleanup }
}

function readArgs(server: string, profile: string, command = ['bug', '7']) {
  return ['run', '--server', server, '--profile', profile, '--', ...command]
}

test('isolates simultaneous A/B reads with identical IDs and preserves global config', async t => {
  const context = await setup(t)
  const results = await Promise.all([
    context.execute(readArgs('https://A.example.test:443/zentao///', profileA)),
    context.execute(readArgs(serverB, profileB)),
  ])
  assert.deepEqual(results.map(result => JSON.parse(result.stdout)), [
    { id: 7, server: serverA, account: 'alice' },
    { id: 7, server: serverB, account: 'bob' },
  ])
  const calls = await context.calls()
  assert.equal(new Set(calls.map(call => call.path)).size, 2)
  assert.equal(calls.filter(call => call.command[0] === 'bug').length, 2)
  await context.checkCleanup()
})

test('profiles uses a copy and exposes metadata without credentials', async t => {
  const context = await setup(t)
  const result = await context.execute(['profiles', '--config', context.config], { ZENTAO_CONFIG_FILE: '/missing/ignored.json' })
  assert.equal(JSON.parse(result.stdout).profiles.length, 2)
  assert.ok(!result.stdout.includes('token'))
  assert.ok(!result.stdout.includes('imaginary-secret'))
  await context.checkCleanup()
})

test('returns module help after selecting the repository profile', async t => {
  const context = await setup(t)
  const result = await context.execute(readArgs(serverB, profileB, ['bug', '--help']))
  assert.deepEqual(JSON.parse(result.stdout), { help: 'Help for bug' })
  const calls = await context.calls()
  assert.deepEqual(calls.at(-1)?.command, ['bug', '--help'])
  await context.checkCleanup()
})

test('rejects missing profiles, account aliases, server mismatches, and a wrong CLI switch before API calls', async t => {
  const context = await setup(t)
  for (const args of [
    readArgs(serverB, profileA),
    readArgs(serverA, 'alice'),
    readArgs(serverA, 'missing@https://a.example.test/zentao'),
    readArgs('https://a.example.test/another-installation', profileA),
  ])
    await assert.rejects(context.execute(args), /different server|Exact profile key/)
  await assert.rejects(context.execute(readArgs(serverB, profileB), { FAKE_ZENTAO_MODE: 'wrong-switch' }), /profile selection did not match/)
  assert.ok((await context.calls()).every(call => call.command[0] === 'profile'))
  await context.checkCleanup()
})

test('rejects business writes and request, config, auth, format overrides before invoking CLI', async t => {
  const context = await setup(t)
  for (const command of [
    ['bug', 'delete', '7'], ['bug', 'resolve', '7'], ['login'], ['bug', '--config', '/other'],
    ['bug', '--options={"method":"DELETE"}'], ['bug', '--params', '{}'], ['bug', '--data={}'],
    ['bug', '--server=https://other.test'], ['bug', '--token=secret'], ['bug', '--format=raw'],
    ['bug', '--filter', '--config=other'], ['bug', '--page=-1'], ['bug', '7', 'create'],
  ])
    await assert.rejects(context.execute(readArgs(serverA, profileA, command)))
  assert.deepEqual(await context.calls(), [])
  await context.checkCleanup()
})

test('rejects server credentials, queries, and fragments before invoking CLI', async t => {
  const context = await setup(t)
  for (const server of ['https://user:password@example.test', `${serverA}?token=x`, `${serverA}#part`, `${serverA}?`, 'ftp://example.test', ` ${serverA}`, 'https://a.example.test\\zentao'])
    await assert.rejects(context.execute(readArgs(server, profileA)), /HTTP\(S\) URL/)
  assert.deepEqual(await context.calls(), [])
})

test('sanitizes CLI failures and removes the temporary credential copy', async t => {
  const context = await setup(t)
  await assert.rejects(context.execute(readArgs(serverA, profileA), { FAKE_ZENTAO_MODE: 'fail' }), error => {
    const result = error as Error & { stdout: string, stderr: string }
    assert.match(result.stderr, /E2008/)
    assert.match(result.stderr, /Service unavailable \(503\)/)
    assert.ok(!`${result.stdout}${result.stderr}`.includes('imaginary-secret-token'))
    return true
  })
  await context.checkCleanup()
})

test('reports no saved login without using environment credentials', async t => {
  for (const login of ['empty', 'missing-token'] as const) {
    const context = await setup(t, login)
    await assert.rejects(context.execute(readArgs(serverA, profileA)), /No saved login|E1006.*No saved profile token/)
    await context.checkCleanup()
  }
})

test('reports an unavailable CLI clearly and leaves the source intact', async t => {
  const context = await setup(t)
  await assert.rejects(context.execute(['profiles'], { PATH: '/nonexistent/zentao-test-bin' }), /CLI is not installed/)
  await context.checkCleanup()
})

test('reports a missing source config without invoking CLI', async t => {
  const context = await setup(t)
  await assert.rejects(context.execute(['profiles', '--config', `${context.config}.missing`]), /configuration not found/)
  assert.deepEqual(await context.calls(), [])
})
