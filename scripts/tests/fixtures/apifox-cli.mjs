#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
import process from 'node:process'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
const token = option('--access-token')
const call = {
  command: args.slice(0, 2),
  project: args.includes('--project') ? option('--project') : null,
  server: option('--api-base-url'),
  credential: token === 'secret-A-for-tests' ? 'a' : token === 'secret-B-for-tests' ? 'b' : 'unknown',
}
appendFileSync(process.env.FAKE_APIFOX_LOG, `${JSON.stringify(call)}\n`)
if (args.includes('--fail')) {
  process.stderr.write(`failed token=${token} encoded=${encodeURIComponent(token)} other=secret-B-for-tests`)
  process.exit(2)
}
if (args.includes('--echo-token')) process.stdout.write(token)
else process.stdout.write(JSON.stringify(call))

