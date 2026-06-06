import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { syncVendorSkills, type VendorSkillMeta } from './sync-vendors.ts'

const temporaryPaths: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

async function createVendorSkill(root: string, vendor: string, skill: string): Promise<void> {
  const skillDir = join(root, 'vendor', vendor, 'skills', skill)
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), `---\nname: ${skill}\ndescription: Use when testing.\n---\n`)
  await writeFile(join(skillDir, 'notes.md'), `# ${skill}\n`)
}

test('syncs configured vendor skills into the skills directory', async () => {
  const root = await createTempDir('skills-repo-')
  await createVendorSkill(root, 'gsap', 'gsap-core')
  await writeFile(join(root, 'vendor', 'gsap', 'LICENSE'), 'MIT\n')

  const vendors: Record<string, VendorSkillMeta> = {
    gsap: {
      source: 'https://github.com/greensock/gsap-skills',
      skills: {
        'gsap-core': 'gsap-core',
      },
    },
  }

  const results = await syncVendorSkills({
    root,
    vendors,
    date: '2026-06-05',
    resolveGitSha: async () => 'abc123',
  })

  assert.deepEqual(results, [{
    vendor: 'gsap',
    sourceSkill: 'gsap-core',
    outputSkill: 'gsap-core',
    status: 'synced',
  }])
  assert.match(await readFile(join(root, 'skills', 'gsap-core', 'SKILL.md'), 'utf-8'), /name: gsap-core/)
  assert.equal(await readFile(join(root, 'skills', 'gsap-core', 'notes.md'), 'utf-8'), '# gsap-core\n')
  assert.equal(await readFile(join(root, 'skills', 'gsap-core', 'LICENSE.md'), 'utf-8'), 'MIT\n')
  assert.equal(await readFile(join(root, 'skills', 'gsap-core', 'SYNC.md'), 'utf-8'), `# Sync Info

- **Source:** \`vendor/gsap/skills/gsap-core\`
- **Repository:** https://github.com/greensock/gsap-skills
- **Git SHA:** \`abc123\`
- **Synced:** 2026-06-05
`)
})

test('reports missing vendor directories without creating output skills', async () => {
  const root = await createTempDir('skills-repo-')
  const vendors: Record<string, VendorSkillMeta> = {
    gsap: {
      source: 'https://github.com/greensock/gsap-skills',
      skills: {
        'gsap-core': 'gsap-core',
      },
    },
  }

  const results = await syncVendorSkills({ root, vendors })

  assert.deepEqual(results, [{
    vendor: 'gsap',
    sourceSkill: 'gsap-core',
    outputSkill: 'gsap-core',
    status: 'missing-vendor',
  }])
  await assert.rejects(() => readFile(join(root, 'skills', 'gsap-core', 'SKILL.md')), /ENOENT/)
})

test('reports configured skills that are missing from an existing vendor', async () => {
  const root = await createTempDir('skills-repo-')
  await mkdir(join(root, 'vendor', 'gsap', 'skills'), { recursive: true })
  const vendors: Record<string, VendorSkillMeta> = {
    gsap: {
      source: 'https://github.com/greensock/gsap-skills',
      skills: {
        'gsap-core': 'gsap-core',
      },
    },
  }

  const results = await syncVendorSkills({ root, vendors })

  assert.deepEqual(results, [{
    vendor: 'gsap',
    sourceSkill: 'gsap-core',
    outputSkill: 'gsap-core',
    status: 'missing-skill',
  }])
})

test('rejects duplicate output skill mappings before copying', async () => {
  const root = await createTempDir('skills-repo-')
  await createVendorSkill(root, 'gsap', 'gsap-core')
  await createVendorSkill(root, 'gsap', 'gsap-react')
  const vendors: Record<string, VendorSkillMeta> = {
    gsap: {
      source: 'https://github.com/greensock/gsap-skills',
      skills: {
        'gsap-core': 'gsap',
        'gsap-react': 'gsap',
      },
    },
  }

  await assert.rejects(
    () => syncVendorSkills({ root, vendors }),
    /Duplicate output skill mapping: gsap/,
  )
  await assert.rejects(() => readFile(join(root, 'skills', 'gsap', 'SKILL.md')), /ENOENT/)
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
