#!/usr/bin/env node
import assert from 'node:assert/strict'
import console from 'node:console'
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
assert.equal(args[0], '--config')
const path = args[1]
assert.equal(statSync(path).mode & 0o777, 0o600)
assert.equal(statSync(dirname(path)).mode & 0o777, 0o700)
assert.ok(args.includes('--format=json'))
assert.ok(args.includes('--machine-readable'))
assert.equal(args[args.indexOf('--timeout') + 1], '10000')
for (const key of ['ZENTAO_CONFIG_FILE', 'ZENTAO_URL', 'ZENTAO_ACCOUNT', 'ZENTAO_PASSWORD', 'ZENTAO_TOKEN'])
  assert.equal(process.env[key], undefined)
const config = JSON.parse(readFileSync(path, 'utf8'))
const command = args.slice(6)
appendFileSync(process.env.FAKE_ZENTAO_LOG, `${JSON.stringify({ path, command })}\n`)
if (process.env.FAKE_ZENTAO_MODE === 'fail') {
  console.error(JSON.stringify({ error: {
    code: '2008', message: 'Service unavailable (503); token: imaginary-secret-token',
    details: { headers: { authorization: 'Bearer imaginary-secret-token' } },
  } }))
  process.exit(1)
}
if (command[0] === 'profile') {
  if (command[1] && command[1] !== '--silent') {
    config.currentProfile = process.env.FAKE_ZENTAO_MODE === 'wrong-switch'
      ? config.profiles[0].key : command[1]
  }
  else {
    console.log(JSON.stringify({
      currentProfile: config.currentProfile,
      profiles: config.profiles.map(profile => ({ ...profile, current: profile.key === config.currentProfile })),
    }))
  }
}
else {
  const current = config.profiles.find(profile => profile.key === config.currentProfile)
  if (command[1] === '--help') console.log(`Help for ${command[0]}`)
  else if (!current?.token) {
    console.error(JSON.stringify({ error: { code: '1006', message: 'No saved profile token' } }))
    process.exit(1)
  }
  else console.log(JSON.stringify({ id: Number(command[1] ?? 7), server: current.server, account: current.account }))
}
config.lastUsedTime = 'changed only in temporary copy'
writeFileSync(path, JSON.stringify(config), { mode: 0o600 })
