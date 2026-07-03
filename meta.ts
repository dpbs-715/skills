/**
 * Skill identifiers, named once here to avoid repeating string literals. Modeled
 * as a const object rather than a TS `enum`: Node runs these `.ts` files in
 * type-stripping mode, which only allows erasable syntax (enums are not).
 */
export const Skill = {
  Commit: 'commit',
  Dcr: 'dcr',
  EngineeringRules: 'engineering-rules',
  PersonalKnowledge: 'personal-knowledge',
  ProblemSolvingRules: 'problem-solving-rules',
} as const

export type Skill = typeof Skill[keyof typeof Skill]

export interface VendorSkillMeta {
  source: string
  skills: Record<string, string>
}

export interface ClaudeRule {
  /** Skill name; also excluded from skill dirs that receive it as a rule. */
  skill: string
  /** Repo-relative markdown linked into rule targets as `<skill>.md`. */
  source: string
}

export interface DirectoryLinkTarget {
  dir: string
  kind: 'skill' | 'rule'
  /** Skill names to link into this target. */
  include: readonly string[]
}

export interface JsonArrayConfigTarget {
  file: string
  kind: 'json-array'
  /** JSON array property to merge configured entries into. */
  property: string
  /** Entries that must be present in the configured array. */
  include: readonly string[]
}

export type LinkTarget = DirectoryLinkTarget | JsonArrayConfigTarget

/** Repo-owned source skills rendered into `generated/<name>/` before linking. */
export const sourceSkills: readonly Skill[] = [
  Skill.Commit,
  Skill.Dcr,
  Skill.EngineeringRules,
  Skill.PersonalKnowledge,
  Skill.ProblemSolvingRules,
]

/** Skills linked into agent skill directories. */
export const linkedSkills: readonly Skill[] = [
  Skill.Commit,
  Skill.Dcr,
  Skill.EngineeringRules,
  Skill.PersonalKnowledge,
  Skill.ProblemSolvingRules,
]

/**
 * Skills that are promoted into always-loaded markdown rule files for agents
 * with rule targets. Other agents can still receive them as skills via
 * {@link linkedSkills}.
 */
export const claudeRules: readonly ClaudeRule[] = [
  { skill: Skill.EngineeringRules, source: 'rules/engineering/RULES.md' },
  { skill: Skill.ProblemSolvingRules, source: 'rules/problem-solving/RULES.md' },
]

const ruleSkillNames: readonly string[] = claudeRules.map(rule => rule.skill)

/**
 * Link configuration — every destination and what it receives. Single source of
 * truth consumed by the generic linker in `scripts/commands/link.ts`. Codex and
 * Agents get the full skill set; Claude and opencode skill directories exclude
 * rule-promoted skills, which instead land as markdown rule files.
 */
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
