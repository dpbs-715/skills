import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import {
  checkUpdates,
  cleanupUnusedEntries,
  getProjects,
  initSubmodules,
  syncSubmodules,
  type RunGit,
} from './skills.ts'
import type { VendorSkillMeta } from './commands/sync-vendors.ts'

const temporaryPaths: string[] = []
const execFileAsync = promisify(execFile)

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

function createRecordingGit(outputs: Record<string, string> = {}): { calls: string[][], runGit: RunGit } {
  const calls: string[][] = []
  return {
    calls,
    runGit: async (args) => {
      calls.push(args)
      return outputs[args.join(' ')] ?? ''
    },
  }
}

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd })
}

const vendors: Record<string, VendorSkillMeta> = {
  gsap: {
    source: 'https://github.com/greensock/gsap-skills',
    skills: {
      'gsap-core': 'gsap-core',
    },
  },
}

test('builds source and vendor projects from metadata', () => {
  const projects = getProjects({
    sources: {
      vue: 'https://github.com/vuejs/docs',
    },
    vendors,
  })

  assert.deepEqual(projects, [
    {
      name: 'vue',
      path: 'sources/vue',
      type: 'source',
      url: 'https://github.com/vuejs/docs',
    },
    {
      name: 'gsap',
      path: 'vendor/gsap',
      type: 'vendor',
      url: 'https://github.com/greensock/gsap-skills',
    },
  ])
})

test('initializes missing submodules from metadata', async () => {
  const root = await createTempDir('skills-repo-')
  const { calls, runGit } = createRecordingGit()

  const results = await initSubmodules({ root, vendors, runGit })

  assert.deepEqual(results, [{
    name: 'gsap',
    path: 'vendor/gsap',
    status: 'added',
    type: 'vendor',
  }])
  assert.deepEqual(calls, [[
    'submodule',
    'add',
    'https://github.com/greensock/gsap-skills',
    'vendor/gsap',
  ]])
})

test('restores gitmodules from the index before initializing', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, '.git'), { recursive: true })
  const calls: string[][] = []
  const runGit: RunGit = async (args) => {
    calls.push(args)
    const command = args.join(' ')
    if (command === 'show :.gitmodules') {
      return `[submodule "vendor/gsap"]
\tpath = vendor/gsap
\turl = https://github.com/greensock/gsap-skills
`
    }
    if (command === 'ls-files --error-unmatch vendor/gsap')
      return 'vendor/gsap\n'
    if (command === '-C vendor/gsap rev-parse --show-toplevel')
      throw new Error('not initialized')
    return ''
  }

  const results = await initSubmodules({ root, vendors, runGit })

  assert.deepEqual(results, [{
    name: 'gsap',
    path: 'vendor/gsap',
    status: 'initialized',
    type: 'vendor',
  }])
  assert.deepEqual(calls, [
    ['show', ':.gitmodules'],
    ['ls-files', '--error-unmatch', 'vendor/gsap'],
    ['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel'],
    ['submodule', 'update', '--init', 'vendor/gsap'],
  ])
})

test('keeps existing submodules during init', async () => {
  const root = await createTempDir('skills-repo-')
  await writeFile(join(root, '.gitmodules'), `[submodule "vendor/gsap"]
\tpath = vendor/gsap
\turl = https://github.com/greensock/gsap-skills
`)
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })
  const { calls, runGit } = createRecordingGit({
    'ls-files --error-unmatch vendor/gsap': 'vendor/gsap\n',
    '-C vendor/gsap rev-parse --show-toplevel': join(root, 'vendor', 'gsap'),
  })

  const results = await initSubmodules({ root, vendors, runGit })

  assert.deepEqual(results, [{
    name: 'gsap',
    path: 'vendor/gsap',
    status: 'exists',
    type: 'vendor',
  }])
  assert.deepEqual(calls, [
    ['ls-files', '--error-unmatch', 'vendor/gsap'],
    ['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel'],
  ])
})

test('initializes registered submodules that are not checked out', async () => {
  const root = await createTempDir('skills-repo-')
  await writeFile(join(root, '.gitmodules'), `[submodule "vendor/gsap"]
\tpath = vendor/gsap
\turl = https://github.com/greensock/gsap-skills
`)
  const calls: string[][] = []
  const runGit: RunGit = async (args) => {
    calls.push(args)
    if (args.join(' ') === 'ls-files --error-unmatch vendor/gsap')
      return 'vendor/gsap\n'
    if (args.join(' ') === '-C vendor/gsap rev-parse --show-toplevel')
      throw new Error('not initialized')
    return ''
  }

  const results = await initSubmodules({ root, vendors, runGit })

  assert.deepEqual(results, [{
    name: 'gsap',
    path: 'vendor/gsap',
    status: 'initialized',
    type: 'vendor',
  }])
  assert.deepEqual(calls, [
    ['ls-files', '--error-unmatch', 'vendor/gsap'],
    ['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel'],
    ['submodule', 'update', '--init', 'vendor/gsap'],
  ])
})

test('repairs registered submodules that are missing from the git index', async () => {
  const root = await createTempDir('skills-repo-')
  await writeFile(join(root, '.gitmodules'), `[submodule "vendor/gsap"]
\tpath = vendor/gsap
\turl = https://github.com/greensock/gsap-skills
`)
  const calls: string[][] = []
  const runGit: RunGit = async (args) => {
    calls.push(args)
    if (args.join(' ') === 'ls-files --error-unmatch vendor/gsap')
      throw new Error('not tracked')
    return ''
  }

  const results = await initSubmodules({ root, vendors, runGit })

  assert.deepEqual(results, [{
    name: 'gsap',
    path: 'vendor/gsap',
    status: 'repaired',
    type: 'vendor',
  }])
  assert.deepEqual(calls, [
    ['ls-files', '--error-unmatch', 'vendor/gsap'],
    ['config', '-f', '.gitmodules', '--remove-section', 'submodule.vendor/gsap'],
    ['submodule', 'add', '--force', 'https://github.com/greensock/gsap-skills', 'vendor/gsap'],
  ])
})

test('sync updates submodules before syncing vendor skills', async () => {
  const root = await createTempDir('skills-repo-')
  const { calls, runGit } = createRecordingGit()
  const syncCalls: string[] = []

  const results = await syncSubmodules({
    root,
    runGit,
    syncVendorSkills: async (options) => {
      syncCalls.push(options.root ?? '')
      return [{
        vendor: 'gsap',
        sourceSkill: 'gsap-core',
        outputSkill: 'gsap-core',
        status: 'synced',
      }]
    },
  })

  assert.deepEqual(calls, [['submodule', 'update', '--init', '--remote', '--merge']])
  assert.deepEqual(syncCalls, [root])
  assert.deepEqual(results, [{
    vendor: 'gsap',
    sourceSkill: 'gsap-core',
    outputSkill: 'gsap-core',
    status: 'synced',
  }])
})

test('checks upstream updates for existing projects', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })
  const { calls, runGit } = createRecordingGit({
    '-C vendor/gsap rev-parse --show-toplevel': join(root, 'vendor', 'gsap'),
    '-C vendor/gsap fetch': '',
    'config -f .gitmodules --get submodule.vendor/gsap.branch': '',
    '-C vendor/gsap symbolic-ref --quiet --short refs/remotes/origin/HEAD': 'origin/main\n',
    '-C vendor/gsap rev-list HEAD..origin/main --count': '2\n',
  })

  const updates = await checkUpdates({ root, vendors, runGit })

  assert.deepEqual(calls, [
    ['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel'],
    ['-C', 'vendor/gsap', 'fetch'],
    ['config', '-f', '.gitmodules', '--get', 'submodule.vendor/gsap.branch'],
    ['-C', 'vendor/gsap', 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    ['-C', 'vendor/gsap', 'rev-list', 'HEAD..origin/main', '--count'],
  ])
  assert.deepEqual(updates, [{
    behind: 2,
    name: 'gsap',
    path: 'vendor/gsap',
    type: 'vendor',
  }])
})

test('skips registered submodule directories that are not checked out', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })
  const calls: string[][] = []
  const runGit: RunGit = async (args) => {
    calls.push(args)
    throw new Error('not a git repository')
  }

  const updates = await checkUpdates({ root, vendors, runGit })

  assert.deepEqual(calls, [['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel']])
  assert.deepEqual(updates, [])
})

test('skips empty submodule directories inside a real git superproject', async () => {
  const root = await createTempDir('skills-repo-')
  await runGit(root, ['init'])
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })

  const updates = await checkUpdates({ root, vendors })

  assert.deepEqual(updates, [])
})

test('rejects unexpected update counts instead of treating them as up to date', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })
  const { runGit } = createRecordingGit({
    '-C vendor/gsap rev-parse --show-toplevel': join(root, 'vendor', 'gsap'),
    '-C vendor/gsap fetch': '',
    'config -f .gitmodules --get submodule.vendor/gsap.branch': '',
    '-C vendor/gsap symbolic-ref --quiet --short refs/remotes/origin/HEAD': 'origin/main\n',
    '-C vendor/gsap rev-list HEAD..origin/main --count': 'not-a-number\n',
  })

  await assert.rejects(
    () => checkUpdates({ root, vendors, runGit }),
    /Unexpected git output/,
  )
})

test('falls back to origin main when origin HEAD is unavailable', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })
  const calls: string[][] = []
  const runGit: RunGit = async (args) => {
    calls.push(args)
    const command = args.join(' ')
    if (command === '-C vendor/gsap rev-parse --show-toplevel')
      return join(root, 'vendor', 'gsap')
    if (command === '-C vendor/gsap fetch')
      return ''
    if (command === 'config -f .gitmodules --get submodule.vendor/gsap.branch')
      return ''
    if (command === '-C vendor/gsap symbolic-ref --quiet --short refs/remotes/origin/HEAD')
      throw new Error('origin HEAD missing')
    if (command === '-C vendor/gsap rev-parse --verify --quiet origin/main')
      return 'abc123\n'
    if (command === '-C vendor/gsap rev-list HEAD..origin/main --count')
      return '0\n'
    throw new Error(`Unexpected git command: ${command}`)
  }

  const updates = await checkUpdates({ root, vendors, runGit })

  assert.deepEqual(updates, [])
  assert.deepEqual(calls, [
    ['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel'],
    ['-C', 'vendor/gsap', 'fetch'],
    ['config', '-f', '.gitmodules', '--get', 'submodule.vendor/gsap.branch'],
    ['-C', 'vendor/gsap', 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    ['-C', 'vendor/gsap', 'rev-parse', '--verify', '--quiet', 'origin/main'],
    ['-C', 'vendor/gsap', 'rev-list', 'HEAD..origin/main', '--count'],
  ])
})

test('uses a configured submodule branch when checking updates', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'vendor', 'gsap'), { recursive: true })
  const { calls, runGit } = createRecordingGit({
    '-C vendor/gsap rev-parse --show-toplevel': join(root, 'vendor', 'gsap'),
    '-C vendor/gsap fetch': '',
    'config -f .gitmodules --get submodule.vendor/gsap.branch': 'stable\n',
    '-C vendor/gsap rev-list HEAD..origin/stable --count': '1\n',
  })

  const updates = await checkUpdates({ root, vendors, runGit })

  assert.deepEqual(updates, [{
    behind: 1,
    name: 'gsap',
    path: 'vendor/gsap',
    type: 'vendor',
  }])
  assert.deepEqual(calls, [
    ['-C', 'vendor/gsap', 'rev-parse', '--show-toplevel'],
    ['-C', 'vendor/gsap', 'fetch'],
    ['config', '-f', '.gitmodules', '--get', 'submodule.vendor/gsap.branch'],
    ['-C', 'vendor/gsap', 'rev-list', 'HEAD..origin/stable', '--count'],
  ])
})

test('cleanup removes extra skills only when confirmed', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'skills', 'engineering-rules'), { recursive: true })
  await mkdir(join(root, 'skills', 'personal-knowledge'), { recursive: true })
  await mkdir(join(root, 'skills', 'gsap-core'), { recursive: true })
  await mkdir(join(root, 'skills', 'extra-skill'), { recursive: true })

  const dryRun = await cleanupUnusedEntries({
    root,
    linkedSkills: ['engineering-rules'],
    templateSkills: ['personal-knowledge'],
    vendors,
    yes: false,
  })
  assert.deepEqual(dryRun.skills, [{ name: 'extra-skill', status: 'would-remove' }])
  assert.deepEqual(await readdir(join(root, 'skills')), ['engineering-rules', 'extra-skill', 'gsap-core', 'personal-knowledge'])

  const confirmed = await cleanupUnusedEntries({
    root,
    linkedSkills: ['engineering-rules'],
    templateSkills: ['personal-knowledge'],
    vendors,
    yes: true,
  })
  assert.deepEqual(confirmed.skills, [{ name: 'extra-skill', status: 'removed' }])
  assert.deepEqual(await readdir(join(root, 'skills')), ['engineering-rules', 'gsap-core', 'personal-knowledge'])
})

test('cleanup only removes extra managed submodules when confirmed', async () => {
  const root = await createTempDir('skills-repo-')
  await writeFile(join(root, '.gitmodules'), `[submodule "vendor/old"]
\tpath = vendor/old
\turl = https://example.com/old.git
[submodule "docs/theme"]
\tpath = docs/theme
\turl = https://example.com/theme.git
`)
  const { calls, runGit } = createRecordingGit({
    'ls-files --error-unmatch vendor/old': 'vendor/old\n',
  })

  const dryRun = await cleanupUnusedEntries({
    root,
    vendors,
    yes: false,
    runGit,
  })
  assert.deepEqual(dryRun.submodules, [{ path: 'vendor/old', status: 'would-remove' }])
  assert.deepEqual(calls, [])

  const confirmed = await cleanupUnusedEntries({
    root,
    vendors,
    yes: true,
    runGit,
  })
  assert.deepEqual(confirmed.submodules, [{ path: 'vendor/old', status: 'removed' }])
  assert.deepEqual(calls, [
    ['ls-files', '--error-unmatch', 'vendor/old'],
    ['submodule', 'deinit', '-f', 'vendor/old'],
    ['rm', '-f', 'vendor/old'],
  ])
})

test('cleanup removes registered but untracked submodule entries', async () => {
  const root = await createTempDir('skills-repo-')
  await writeFile(join(root, '.gitmodules'), `[submodule "vendor/gsap"]
\tpath = vendor/gsap
\turl = https://github.com/greensock/gsap-skills
`)
  const calls: string[][] = []
  const runGit: RunGit = async (args) => {
    calls.push(args)
    if (args.join(' ') === 'ls-files --error-unmatch vendor/gsap')
      throw new Error('not tracked')
    return ''
  }

  const results = await cleanupUnusedEntries({
    root,
    vendors: {},
    yes: true,
    runGit,
  })

  assert.deepEqual(results.submodules, [{ path: 'vendor/gsap', status: 'removed' }])
  assert.deepEqual(calls, [
    ['ls-files', '--error-unmatch', 'vendor/gsap'],
    ['config', '-f', '.gitmodules', '--remove-section', 'submodule.vendor/gsap'],
  ])
  await assert.rejects(() => readFile(join(root, '.gitmodules')), /ENOENT/)
})

test('cleanup removes an empty gitmodules file', async () => {
  const root = await createTempDir('skills-repo-')
  await writeFile(join(root, '.gitmodules'), '')

  const results = await cleanupUnusedEntries({
    root,
    vendors: {},
    yes: true,
  })

  assert.deepEqual(results.submodules, [])
  await assert.rejects(() => readFile(join(root, '.gitmodules')), /ENOENT/)
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
