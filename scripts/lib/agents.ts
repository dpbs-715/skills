import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

import { agentOnlySkills, installableSkills } from '../../meta.ts'
import type { AgentFormat } from './metaTypes.ts'
import { ensureLink, type LinkResult, pruneLinks } from './symlink.ts'
import { pathExists, repoRoot } from './utils.ts'

const agentNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const formats: readonly AgentFormat[] = ['claude', 'kimi-code', 'opencode', 'pi']
export const GENERATED_AGENTS_DIR = join('generated', 'agents')

interface AgentManifest {
  agentOnlySkills?: string[]
  name: string
  description: string
  rules: string[]
  skills: string[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

async function readAgent(root: string, directory: string): Promise<{ manifest: AgentManifest, body: string }> {
  const sourceDir = join(root, 'agents', directory)
  const raw: unknown = JSON.parse(await readFile(join(sourceDir, 'agent.json'), 'utf8'))
  if (!raw || typeof raw !== 'object')
    throw new Error(`Invalid agent manifest: agents/${directory}/agent.json`)

  const manifest = raw as Record<string, unknown>
  if (
    manifest.name !== directory
    || !agentNamePattern.test(directory)
    || typeof manifest.description !== 'string'
    || !manifest.description.trim()
    || !isStringArray(manifest.rules)
    || !isStringArray(manifest.skills)
    || (manifest.agentOnlySkills !== undefined && !isStringArray(manifest.agentOnlySkills))
  )
    throw new Error(`Invalid agent manifest: agents/${directory}/agent.json`)

  const allowedSkills = new Set<string>(installableSkills)
  for (const skill of manifest.skills) {
    if (!allowedSkills.has(skill))
      throw new Error(`Unknown skill ${skill} in agent ${directory}`)
  }
  const allowedAgentOnlySkills = new Set<string>(agentOnlySkills)
  for (const skill of (manifest.agentOnlySkills as string[] | undefined) ?? []) {
    if (!allowedAgentOnlySkills.has(skill))
      throw new Error(`Unknown agent-only skill ${skill} in agent ${directory}`)
  }

  for (const rule of manifest.rules) {
    const rulePath = resolve(root, rule)
    if (!rulePath.startsWith(join(root, 'rules') + sep) || !rule.endsWith('.md') || !await pathExists(rulePath))
      throw new Error(`Invalid rule ${rule} in agent ${directory}`)
  }

  const body = (await readFile(join(sourceDir, 'AGENT.md'), 'utf8')).trim()
  if (!body)
    throw new Error(`Empty agent instructions: agents/${directory}/AGENT.md`)

  return { manifest: manifest as unknown as AgentManifest, body }
}

function renderAgent(root: string, agent: { manifest: AgentManifest, body: string }, format: AgentFormat): string {
  const { manifest, body } = agent
  const frontmatter = [
    '---',
    `name: ${manifest.name}`,
    `description: ${JSON.stringify(manifest.description)}`,
  ]
  if (format === 'claude' && manifest.skills.length > 0) {
    frontmatter.push('skills:')
    frontmatter.push(...manifest.skills.map(skill => `  - ${skill}`))
  }
  if (format === 'opencode')
    frontmatter.push('mode: subagent')
  frontmatter.push('---')

  const rules = manifest.rules.length > 0
    ? manifest.rules.map((rule) => {
        const path = join(root, rule)
        return `- Read and follow [${rule}](${path.includes(' ') ? `<${path}>` : path}).`
      }).join('\n')
    : '- Follow applicable workspace instructions.'
  const skills = manifest.skills.length > 0
    ? manifest.skills.map(skill => `- ${skill}`).join('\n')
    : '- No role-specific skills are configured.'
  const agentOnly = (manifest.agentOnlySkills ?? []).map((skill) => {
    const path = join(root, 'generated', skill, 'SKILL.md')
    return `- Read [${skill}](${path.includes(' ') ? `<${path}>` : path}) when relevant. This skill is not installed in the general skill list and is intended for this role.`
  }).join('\n')
  const agentOnlySection = agentOnly ? `\n\n## Agent-only skills\n\n${agentOnly}` : ''

  return `${frontmatter.join('\n')}\n\n${body}\n\n## Shared rules\n\n${rules}\n\n## Role skills\n\n${skills}${agentOnlySection}\n\nUse these skills when relevant to the assigned task. The user may explicitly request another available skill.\n\nReturn a concise, self-contained result to the delegating agent. Include the role name, task outcome, skills actually used, deliverables, and checks or blockers.\n`
}

export async function expectedAgentFiles(root = repoRoot()): Promise<Array<{
  content: string
  format: AgentFormat
  name: string
}>> {
  const sourceDir = join(root, 'agents')
  if (!await pathExists(sourceDir))
    return []

  const entries = (await readdir(sourceDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
  const agents = await Promise.all(entries.map(directory => readAgent(root, directory)))

  return formats.flatMap(format => agents.map(agent => ({
    content: renderAgent(root, agent, format),
    format,
    name: agent.manifest.name,
  })))
}

export async function renderAgents(root = repoRoot()): Promise<string[]> {
  const files = await expectedAgentFiles(root)
  if (files.length === 0) {
    await rm(join(root, GENERATED_AGENTS_DIR), { force: true, recursive: true })
    return []
  }

  for (const format of formats) {
    const targetDir = join(root, GENERATED_AGENTS_DIR, format)
    await rm(targetDir, { force: true, recursive: true })
    await mkdir(targetDir, { recursive: true })
    for (const file of files.filter(file => file.format === format))
      await writeFile(join(targetDir, `${file.name}.md`), file.content)
  }

  return files.filter(file => file.format === formats[0]).map(file => file.name)
}

export async function createAgentLinks(options: {
  format: AgentFormat
  names: readonly string[]
  root?: string
  target: string
}): Promise<LinkResult[]> {
  const { format, names, root = repoRoot(), target } = options
  const sourceDir = join(root, GENERATED_AGENTS_DIR, format)
  await mkdir(target, { recursive: true })
  const results: LinkResult[] = []
  for (const name of names) {
    const status = await ensureLink(join(sourceDir, `${name}.md`), join(target, `${name}.md`), {
      replaceFrom: [join(root, GENERATED_AGENTS_DIR)],
    })
    results.push({ name: `${name}.md`, target, status })
  }
  results.push(...await pruneLinks(target, new Set(names.map(name => `${name}.md`)), sourceDir))
  return results
}

export async function removeAgentLinks(options: {
  format: AgentFormat
  root?: string
  target: string
}): Promise<LinkResult[]> {
  const { format, root = repoRoot(), target } = options
  return pruneLinks(target, new Set(), join(root, GENERATED_AGENTS_DIR, format))
}
