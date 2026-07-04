#!/usr/bin/env node

import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { run as runCheck } from './commands/check.ts'
import { run as runCleanup } from './commands/cleanup.ts'
import { run as runInit } from './commands/init.ts'
import { runLink, runUnlink } from './commands/link.ts'
import { run as runNote } from './commands/note.ts'
import { run as runStatus } from './commands/status.ts'
import { run as runSync } from './commands/sync.ts'
import { run as runValidate } from './commands/validate.ts'

interface Command {
  summary: string
  run: (args: string[]) => Promise<void>
}

const COMMANDS: Record<string, Command> = {
  status: { summary: 'Show configured skills, their roles, and submodule state', run: runStatus },
  link: { summary: 'Symlink configured skills into local agent skill directories', run: runLink },
  unlink: { summary: 'Remove skill symlinks created by this repo', run: runUnlink },
  sync: { summary: 'Update submodules, then sync vendored skills into generated/', run: runSync },
  init: { summary: 'Add missing vendor git submodules from meta.ts', run: runInit },
  check: { summary: 'Fetch submodules and report upstream updates', run: runCheck },
  cleanup: { summary: 'Report unused submodules and generated skills; pass --yes to remove', run: runCleanup },
  validate: { summary: 'Validate local sources, generated skills, and skill metadata', run: runValidate },
  note: { summary: 'Manage private knowledge notes: list, reindex, or add', run: runNote },
}

function printHelp(): void {
  const width = Math.max(...Object.keys(COMMANDS).map(name => name.length))
  const lines = Object.entries(COMMANDS)
    .map(([name, command]) => `  ${name.padEnd(width)}  ${command.summary}`)
    .join('\n')
  console.log(`Usage: pnpm skills <command>\n\nCommands:\n${lines}\n`)
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const name = argv.find(arg => !arg.startsWith('-'))

  if (!name || name === 'help' || name === '--help' || name === '-h') {
    printHelp()
    return
  }

  const command = COMMANDS[name]
  if (!command) {
    console.error(`Unknown command: ${name}`)
    printHelp()
    process.exitCode = 1
    return
  }

  const index = argv.indexOf(name)
  await command.run([...argv.slice(0, index), ...argv.slice(index + 1)])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
