import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { readTeams, scheduleTeam } from '../lib/teams.ts'

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skills-teams-'))
  await mkdir(join(root, 'teams', 'sample-team'), { recursive: true })
  for (const name of ['planner', 'builder']) {
    await mkdir(join(root, 'agents', name), { recursive: true })
    await writeFile(join(root, 'agents', name, 'agent.json'), '{}')
  }
  await writeFile(join(root, 'teams', 'sample-team', 'TEAM.md'), '# Sample Team\n')
  return root
}

async function writeTeam(root: string, tasks: unknown[]): Promise<void> {
  await writeFile(join(root, 'teams', 'sample-team', 'team.json'), JSON.stringify({
    name: 'sample-team',
    description: 'Coordinate a sample task.',
    tasks,
  }))
}

test('an empty template catalog is valid', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skills-teams-'))
  try {
    assert.deepEqual(await readTeams(root), [])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a team template supports parallel and linear waves', async () => {
  const root = await fixture()
  try {
    await writeTeam(root, [
      { id: 'scope', agent: 'planner', goal: 'Define scope.', dependsOn: [] },
      { id: 'survey', agent: 'builder', goal: 'Inspect code.', dependsOn: [] },
      { id: 'build', agent: 'builder', goal: 'Build feature.', dependsOn: ['scope', 'survey'] },
      { id: 'accept', agent: 'planner', goal: 'Check behavior.', dependsOn: ['build'] },
    ])
    const [team] = await readTeams(root)
    assert.deepEqual(scheduleTeam(team).map(wave => wave.map(task => task.id)), [
      ['scope', 'survey'],
      ['build'],
      ['accept'],
    ])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects dependencies on missing tasks', async () => {
  const root = await fixture()
  try {
    await writeTeam(root, [
      { id: 'build', agent: 'builder', goal: 'Build feature.', dependsOn: ['missing'] },
    ])
    await assert.rejects(() => readTeams(root), /Unknown dependency missing/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects dependency cycles', async () => {
  const root = await fixture()
  try {
    await writeTeam(root, [
      { id: 'first', agent: 'planner', goal: 'First task.', dependsOn: ['second'] },
      { id: 'second', agent: 'builder', goal: 'Second task.', dependsOn: ['first'] },
    ])
    await assert.rejects(() => readTeams(root), /Dependency cycle/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects an agent outside the role catalog', async () => {
  const root = await fixture()
  try {
    await writeTeam(root, [
      { id: 'build', agent: 'missing-agent', goal: 'Build feature.', dependsOn: [] },
    ])
    await assert.rejects(() => readTeams(root), /Unknown agent missing-agent/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
