import type { LinkTarget, LocalSkillSource, VendorSkillMeta } from './scripts/lib/metaTypes.ts'

// Use a const object instead of enum because Node strips types only for erasable syntax.
export const Skill = {
  Cpush: 'cpush',
  Commit: 'commit',
  Dcr: 'dcr',
  EngineeringRules: 'engineering-rules',
  Mock: 'mock',
  PersonalKnowledge: 'personal-knowledge',
  ProblemSolvingRules: 'problem-solving-rules',
  Push: 'push',
} as const

export const localSkillSources = [
  { kind: 'directory', name: Skill.Cpush, path: 'skills/cpush' },
  { kind: 'directory', name: Skill.Commit, path: 'skills/commit' },
  { kind: 'directory', name: Skill.Dcr, path: 'skills/dcr' },
  { kind: 'directory', name: Skill.Mock, path: 'skills/mock' },
  {
    description: 'Use when writing, modifying, or reviewing code.',
    instructions: [
      'Load only the topic files that match the work. Prefer more specific project rules when they conflict with these personal rules.',
    ],
    kind: 'document',
    name: Skill.EngineeringRules,
    shortDescription: 'engineering rules',
    source: 'rules/engineering/RULES.md',
    title: 'Engineering Rules',
  },
  {
    description: 'Use when the user asks about saved personal notes, remembered judgments, reusable context, command notes, prior knowledge, or whether something has been recorded before.',
    instructions: [
      'Use it as a lightweight index for reusable personal notes and command notes.',
      'Only open the specific note needed for the current request. Do not load every note unless the user explicitly asks for a full inventory.',
    ],
    kind: 'document',
    name: Skill.PersonalKnowledge,
    shortDescription: 'personal knowledge notes',
    source: 'knowledge/INDEX.md',
    title: 'Personal Knowledge',
  },
  {
    description: 'Use when investigating problems, failures, warnings, errors, conflicting signals, unclear claims, or deciding whether to suppress, work around, or verify a symptom.',
    instructions: [
      'Load only the topic files that match the work. Prefer more specific project rules when they conflict with these personal rules.',
    ],
    kind: 'document',
    name: Skill.ProblemSolvingRules,
    shortDescription: 'problem-solving rules',
    source: 'rules/problem-solving/RULES.md',
    title: 'Problem Solving Rules',
  },
  { kind: 'directory', name: Skill.Push, path: 'skills/push' },
] as const satisfies readonly LocalSkillSource[]

export const installableSkills = localSkillSources.map(source => source.name)

export const alwaysOnInstructionSkills = [
  Skill.EngineeringRules,
  Skill.ProblemSolvingRules,
] as const

const alwaysOnInstructionSet = new Set<string>(alwaysOnInstructionSkills)
const normalSkillNames = installableSkills.filter(name => !alwaysOnInstructionSet.has(name))

export const linkTargets: readonly LinkTarget[] = [
  { dir: '~/.codex/skills', kind: 'skill', include: installableSkills },
  {
    dir: '~/.config/opencode/skills',
    kind: 'skill',
    include: normalSkillNames,
  },
  { dir: '~/.config/opencode/rules', kind: 'rule', include: alwaysOnInstructionSkills },
  {
    file: '~/.config/opencode/opencode.json',
    kind: 'json-array',
    property: 'instructions',
    include: ['~/.config/opencode/rules/*.md'],
  },
  { dir: '~/.agents/skills', kind: 'skill', include: installableSkills },
  {
    dir: '~/.claude/skills',
    kind: 'skill',
    include: normalSkillNames,
  },
  { dir: '~/.claude/rules', kind: 'rule', include: alwaysOnInstructionSkills },
]

export const vendors: Record<string, VendorSkillMeta> = {

}
