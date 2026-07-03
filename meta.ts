// Use a const object instead of enum because Node strips types only for erasable syntax.
export const Skill = {
  Commit: 'commit',
  Dcr: 'dcr',
  EngineeringRules: 'engineering-rules',
  PersonalKnowledge: 'personal-knowledge',
  ProblemSolvingRules: 'problem-solving-rules',
  Push: 'push',
} as const

export type Skill = typeof Skill[keyof typeof Skill]

export interface VendorSkillMeta {
  source: string
  skills: Record<string, string>
}

export interface ClaudeRule {
  skill: string
  source: string
}

export interface DirectoryLinkTarget {
  dir: string
  kind: 'skill' | 'rule'
  include: readonly string[]
}

export interface JsonArrayConfigTarget {
  file: string
  kind: 'json-array'
  property: string
  include: readonly string[]
}

export type LinkTarget = DirectoryLinkTarget | JsonArrayConfigTarget

export const sourceSkills: readonly Skill[] = [
  Skill.Commit,
  Skill.Dcr,
  Skill.EngineeringRules,
  Skill.PersonalKnowledge,
  Skill.ProblemSolvingRules,
  Skill.Push,
]

export const linkedSkills: readonly Skill[] = [
  Skill.Commit,
  Skill.Dcr,
  Skill.EngineeringRules,
  Skill.PersonalKnowledge,
  Skill.ProblemSolvingRules,
  Skill.Push,
]

export const claudeRules: readonly ClaudeRule[] = [
  { skill: Skill.EngineeringRules, source: 'rules/engineering/RULES.md' },
  { skill: Skill.ProblemSolvingRules, source: 'rules/problem-solving/RULES.md' },
]

const ruleSkillNames: readonly string[] = claudeRules.map(rule => rule.skill)

export const linkTargets: readonly LinkTarget[] = [
  { dir: '~/.codex/skills', kind: 'skill', include: linkedSkills },
  {
    dir: '~/.config/opencode/skills',
    kind: 'skill',
    include: linkedSkills.filter(name => !ruleSkillNames.includes(name)),
  },
  { dir: '~/.config/opencode/rules', kind: 'rule', include: ruleSkillNames },
  {
    file: '~/.config/opencode/opencode.json',
    kind: 'json-array',
    property: 'instructions',
    include: ['~/.config/opencode/rules/*.md'],
  },
  { dir: '~/.agents/skills', kind: 'skill', include: linkedSkills },
  {
    dir: '~/.claude/skills',
    kind: 'skill',
    include: linkedSkills.filter(name => !ruleSkillNames.includes(name)),
  },
  { dir: '~/.claude/rules', kind: 'rule', include: ruleSkillNames },
]

export const vendors: Record<string, VendorSkillMeta> = {

}
