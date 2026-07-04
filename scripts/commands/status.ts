import { join } from 'node:path'

import {
  installableSkills as defaultInstallableSkills,
  localSkillSources as defaultLocalSkillSources,
  vendors as defaultVendors,
} from '../../meta.ts'
import { getProjects, type Project } from '../lib/git.ts'
import type { LocalSkillSource, VendorSkillMeta } from '../lib/metaTypes.ts'
import { discoverSkills, GENERATED_SKILLS_DIR } from '../lib/skillLinks.ts'
import { isDirectoryNonEmpty, repoRoot } from '../lib/utils.ts'

export type SkillRole = 'local' | 'installable' | 'vendor'

export interface SkillStatus {
  name: string
  present: boolean
  roles: SkillRole[]
}

export interface ProjectStatus {
  checkedOut: boolean
  name: string
  path: string
  type: Project['type']
}

export interface RepoStatus {
  extraSkills: string[]
  projects: ProjectStatus[]
  skills: SkillStatus[]
}

interface StatusOptions {
  installableSkills?: readonly string[]
  localSkillSources?: readonly LocalSkillSource[]
  root?: string
  vendors?: Record<string, VendorSkillMeta>
}

const SKILL_ROLE_ORDER: SkillRole[] = ['local', 'installable', 'vendor']

/**
 * Read-only inventory of what `meta.ts` configures versus what is actually on
 * disk: which skills are expected (and why), whether each generated bundle is
 * present, any generated skill directories not declared in `meta.ts`, and the
 * checkout state of configured submodules. Drives `pnpm skills status`.
 */
export async function collectStatus({
  installableSkills = defaultInstallableSkills,
  localSkillSources = defaultLocalSkillSources,
  root = repoRoot(),
  vendors = defaultVendors,
}: StatusOptions = {}): Promise<RepoStatus> {
  const roles = new Map<string, Set<SkillRole>>()
  const addRole = (name: string, role: SkillRole): void => {
    const existing = roles.get(name) ?? new Set<SkillRole>()
    existing.add(role)
    roles.set(name, existing)
  }

  for (const source of localSkillSources)
    addRole(source.name, 'local')
  for (const name of installableSkills)
    addRole(name, 'installable')
  for (const vendor of Object.values(vendors)) {
    for (const outputSkill of Object.values(vendor.skills))
      addRole(outputSkill, 'vendor')
  }

  const present = new Set((await discoverSkills(root)).map(skill => skill.name))

  const skills: SkillStatus[] = [...roles.entries()]
    .map(([name, set]) => ({
      name,
      present: present.has(name),
      roles: SKILL_ROLE_ORDER.filter(role => set.has(role)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const extraSkills = [...present]
    .filter(name => !roles.has(name))
    .sort((left, right) => left.localeCompare(right))

  const projects: ProjectStatus[] = []
  for (const project of getProjects({ vendors })) {
    projects.push({
      checkedOut: await isDirectoryNonEmpty(join(root, project.path)),
      name: project.name,
      path: project.path,
      type: project.type,
    })
  }

  return { extraSkills, projects, skills }
}

function printStatus(status: RepoStatus): void {
  console.log('Skills:')
  if (status.skills.length === 0) {
    console.log('  (none configured in meta.ts)')
  }
  else {
    for (const skill of status.skills) {
      const state = skill.present ? 'present' : 'MISSING'
      console.log(`  ${skill.name} [${skill.roles.join(', ')}] ${state}`)
    }
  }

  if (status.extraSkills.length > 0) {
    console.log(`\nUntracked generated skills (in ${GENERATED_SKILLS_DIR}/ but not declared in meta.ts):`)
    for (const name of status.extraSkills)
      console.log(`  ${name}`)
  }

  if (status.projects.length > 0) {
    console.log('\nSubmodules:')
    for (const project of status.projects) {
      const state = project.checkedOut ? 'checked out' : 'not initialized'
      console.log(`  ${project.path} (${project.type}) ${state}`)
    }
  }
}

export async function run(): Promise<void> {
  printStatus(await collectStatus())
}
