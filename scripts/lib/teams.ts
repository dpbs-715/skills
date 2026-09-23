import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { pathExists, repoRoot } from './utils.ts'

const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface TeamTask {
  agent: string
  dependsOn: string[]
  goal: string
  id: string
}

export interface TeamTemplate {
  description: string
  name: string
  tasks: TeamTask[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function scheduleTeam(team: TeamTemplate): TeamTask[][] {
  const byId = new Map(team.tasks.map(task => [task.id, task]))
  if (byId.size !== team.tasks.length)
    throw new Error(`Duplicate task id in team ${team.name}`)

  for (const task of team.tasks) {
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency))
        throw new Error(`Unknown dependency ${dependency} in team ${team.name}`)
    }
  }

  const completed = new Set<string>()
  const waves: TeamTask[][] = []
  while (completed.size < team.tasks.length) {
    const ready = team.tasks.filter(task => !completed.has(task.id) && task.dependsOn.every(id => completed.has(id)))
    if (ready.length === 0)
      throw new Error(`Dependency cycle in team ${team.name}`)
    waves.push(ready)
    for (const task of ready)
      completed.add(task.id)
  }
  return waves
}

export { scheduleTeam }

async function readTeam(root: string, directory: string): Promise<TeamTemplate> {
  const sourceDir = join(root, 'teams', directory)
  const raw: unknown = JSON.parse(await readFile(join(sourceDir, 'team.json'), 'utf8'))
  if (!raw || typeof raw !== 'object')
    throw new Error(`Invalid team manifest: teams/${directory}/team.json`)

  const value = raw as Record<string, unknown>
  if (
    value.name !== directory
    || !identifierPattern.test(directory)
    || typeof value.description !== 'string'
    || !value.description.trim()
    || !Array.isArray(value.tasks)
    || value.tasks.length === 0
  )
    throw new Error(`Invalid team manifest: teams/${directory}/team.json`)

  const tasks: TeamTask[] = []
  for (const rawTask of value.tasks) {
    const task = rawTask as Record<string, unknown> | null
    if (
      !task
      || typeof task !== 'object'
      || typeof task.id !== 'string'
      || !identifierPattern.test(task.id)
      || typeof task.agent !== 'string'
      || !identifierPattern.test(task.agent)
      || typeof task.goal !== 'string'
      || !task.goal.trim()
      || !isStringArray(task.dependsOn)
    )
      throw new Error(`Invalid task in team ${directory}`)
    if (!await pathExists(join(root, 'agents', task.agent, 'agent.json')))
      throw new Error(`Unknown agent ${task.agent} in team ${directory}`)
    tasks.push(task as unknown as TeamTask)
  }

  const guidance = (await readFile(join(sourceDir, 'TEAM.md'), 'utf8')).trim()
  if (!guidance)
    throw new Error(`Empty team instructions: teams/${directory}/TEAM.md`)

  const team = { description: value.description, name: directory, tasks } as TeamTemplate
  scheduleTeam(team)
  return team
}

export async function readTeams(root = repoRoot()): Promise<TeamTemplate[]> {
  const sourceDir = join(root, 'teams')
  if (!await pathExists(sourceDir))
    return []

  const entries = (await readdir(sourceDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
  return Promise.all(entries.map(directory => readTeam(root, directory)))
}
