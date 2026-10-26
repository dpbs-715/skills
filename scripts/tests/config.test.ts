import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import { initConfig, loadConfig } from '../lib/config.ts'
import { pathExists, repoRoot } from '../lib/utils.ts'

const execFileAsync = promisify(execFile)
const defaults = `
export const agentOnlySkills = []
export const alwaysOnInstructionSkills = []
export const installableSkills = ['template-skill']
export const linkTargets = []
export const localSkillSources = []
export const vendors = {}
`

async function fixture(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'skills-config-')))
  await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
  await writeFile(join(root, 'meta.template.ts'), defaults)
  return root
}

test('missing local config uses the template without creating files', async () => {
  const root = await fixture()
  try {
    assert.deepEqual((await loadConfig(root)).installableSkills, ['template-skill'])
    assert.equal(await pathExists(join(root, 'meta.ts')), false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('local config takes precedence and failures do not silently use the template', async () => {
  const root = await fixture()
  const broken = await fixture()
  try {
    await writeFile(join(root, 'meta.ts'), defaults.replace('template-skill', 'local-skill'))
    assert.deepEqual((await loadConfig(root)).installableSkills, ['local-skill'])
    await writeFile(join(broken, 'meta.ts'), 'throw new Error("invalid local config")\n')
    await assert.rejects(loadConfig(broken), /invalid local config/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
    await rm(broken, { recursive: true, force: true })
  }
})

test('initialization copies the template once and preserves local customization', async () => {
  const root = await fixture()
  try {
    const results = await Promise.all([initConfig(root), initConfig(root)])
    assert.deepEqual(results.sort(), ['created', 'exists'])
    assert.equal(await readFile(join(root, 'meta.ts'), 'utf8'), defaults)

    const custom = defaults.replace('template-skill', 'local-skill')
    await writeFile(join(root, 'meta.ts'), custom)
    await writeFile(join(root, 'meta.template.ts'), defaults.replace('template-skill', 'new-default'))
    assert.equal(await initConfig(root), 'exists')
    assert.equal(await readFile(join(root, 'meta.ts'), 'utf8'), custom)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a fresh checkout can run help and read-only discovery before initializing local config', async () => {
  const root = await fixture()
  try {
    await cp(join(repoRoot(), 'scripts'), join(root, 'scripts'), {
      recursive: true,
      filter: source => source !== join(repoRoot(), 'scripts/tests'),
    })
    await symlink(join(repoRoot(), 'node_modules'), join(root, 'node_modules'), 'dir')
    await mkdir(join(root, 'local/project-workspaces'), { recursive: true })
    const cli = join(root, 'scripts/skills.ts')
    const help = await execFileAsync(process.execPath, [cli, '--help'], { cwd: root })
    assert.match(help.stdout, /Usage: pnpm skills/)
    const discovery = await execFileAsync(process.execPath, [cli, 'project', 'discover', '--cwd', root], { cwd: root })
    assert.deepEqual(JSON.parse(discovery.stdout).workspaces, [])
    assert.equal(await pathExists(join(root, 'meta.ts')), false)

    const init = await execFileAsync(process.execPath, [cli, 'init'], { cwd: root })
    assert.match(init.stdout, /created: meta\.ts/)
    assert.equal(await readFile(join(root, 'meta.ts'), 'utf8'), defaults)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
