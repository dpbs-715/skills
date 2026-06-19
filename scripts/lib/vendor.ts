import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { vendors as defaultVendors, type VendorSkillMeta } from '../../meta.ts'
import { execFileText, pathExists, repoRoot } from './utils.ts'

export type { VendorSkillMeta }

export type SyncStatus = 'missing-skill' | 'missing-vendor' | 'synced'

export interface SyncResult {
  vendor: string
  sourceSkill: string
  outputSkill: string
  status: SyncStatus
}

export interface SyncVendorSkillsOptions {
  date?: string
  resolveGitSha?: (path: string) => Promise<string | null>
  root?: string
  vendors?: Record<string, VendorSkillMeta>
}

const LICENSE_NAMES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'license',
  'license.md',
  'license.txt',
] as const

async function defaultResolveGitSha(path: string): Promise<string | null> {
  try {
    return await execFileText('git', ['-C', path, 'rev-parse', 'HEAD'], repoRoot())
  }
  catch {
    return null
  }
}

async function copyLicense(vendorPath: string, outputPath: string): Promise<void> {
  for (const licenseName of LICENSE_NAMES) {
    const licensePath = join(vendorPath, licenseName)
    if (!await pathExists(licensePath))
      continue

    await cp(licensePath, join(outputPath, 'LICENSE.md'))
    return
  }
}

function syncInfo({
  date,
  repository,
  sha,
  source,
}: {
  date: string
  repository: string
  sha: string | null
  source: string
}): string {
  return `# Sync Info

- **Source:** \`${source}\`
- **Repository:** ${repository}
- **Git SHA:** \`${sha ?? 'unknown'}\`
- **Synced:** ${date}
`
}

function assertUniqueOutputSkills(vendors: Record<string, VendorSkillMeta>): void {
  const outputs = new Map<string, string>()

  for (const [vendorName, vendor] of Object.entries(vendors)) {
    for (const [sourceSkill, outputSkill] of Object.entries(vendor.skills)) {
      const source = `${vendorName}/${sourceSkill}`
      const existing = outputs.get(outputSkill)
      if (existing)
        throw new Error(`Duplicate output skill mapping: ${outputSkill} (${existing}, ${source})`)

      outputs.set(outputSkill, source)
    }
  }
}

export async function syncVendorSkills({
  date = new Date().toISOString().slice(0, 10),
  resolveGitSha = defaultResolveGitSha,
  root = repoRoot(),
  vendors = defaultVendors,
}: SyncVendorSkillsOptions = {}): Promise<SyncResult[]> {
  assertUniqueOutputSkills(vendors)

  const results: SyncResult[] = []

  for (const [vendorName, vendor] of Object.entries(vendors)) {
    const vendorPath = join(root, 'vendor', vendorName)
    const vendorSkillsPath = join(vendorPath, 'skills')
    const hasVendorSkills = await pathExists(vendorSkillsPath)
    const sha = hasVendorSkills ? await resolveGitSha(vendorPath) : null

    for (const [sourceSkill, outputSkill] of Object.entries(vendor.skills)) {
      const resultBase = {
        vendor: vendorName,
        sourceSkill,
        outputSkill,
      }

      if (!hasVendorSkills) {
        results.push({ ...resultBase, status: 'missing-vendor' })
        continue
      }

      const sourcePath = join(vendorSkillsPath, sourceSkill)
      if (!await pathExists(sourcePath)) {
        results.push({ ...resultBase, status: 'missing-skill' })
        continue
      }

      const outputPath = join(root, 'skills', outputSkill)
      await rm(outputPath, { recursive: true, force: true })
      await mkdir(outputPath, { recursive: true })
      await cp(sourcePath, outputPath, { recursive: true })
      await copyLicense(vendorPath, outputPath)
      await writeFile(join(outputPath, 'SYNC.md'), syncInfo({
        date,
        repository: vendor.source,
        sha,
        source: `vendor/${vendorName}/skills/${sourceSkill}`,
      }))

      results.push({ ...resultBase, status: 'synced' })
    }
  }

  return results
}
