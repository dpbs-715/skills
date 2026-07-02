/**
 * Skill identifiers, named once here to avoid repeating string literals. Modeled
 * as a const object rather than a TS `enum`: Node runs these `.ts` files in
 * type-stripping mode, which only allows erasable syntax (enums are not).
 */
export const Skill = {
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
  /** Skill name; also excluded from `~/.claude/skills`. */
  skill: string
  /** Repo-relative markdown linked into `~/.claude/rules/<skill>.md`. */
  source: string
}

export interface LinkTarget {
  dir: string
  kind: 'skill' | 'rule'
  /** Skill names to link into this target. */
  include: readonly string[]
}

/** Skills rendered from `templates/<name>/SKILL.md` before linking. */
export const templateSkills: readonly Skill[] = [
  Skill.EngineeringRules,
  Skill.PersonalKnowledge,
  Skill.ProblemSolvingRules,
]

/** Skills linked into agent skill directories. */
export const linkedSkills: readonly Skill[] = [
  Skill.EngineeringRules,
  Skill.PersonalKnowledge,
  Skill.ProblemSolvingRules,
]

/**
 * Skills that, for Claude only, are linked as markdown rule files into
 * `~/.claude/rules/` instead of as skills in `~/.claude/skills/`. Claude
 * auto-loads `.claude/rules/*.md` into context every session, so these always
 * apply without relying on model-discretion skill invocation. Other agents
 * (Codex, Agents) still receive them as skills via {@link linkedSkills}.
 */
export const claudeRules: readonly ClaudeRule[] = [
  { skill: Skill.EngineeringRules, source: 'rules/engineering/RULES.md' },
  { skill: Skill.ProblemSolvingRules, source: 'rules/problem-solving/RULES.md' },
]

const ruleSkillNames: readonly string[] = claudeRules.map(rule => rule.skill)

/**
 * Link configuration — every destination and what it receives. Single source of
 * truth consumed by the generic linker in `scripts/commands/link.ts`. Codex and
 * Agents get the full skill set; Claude's skill directory excludes rule-promoted
 * skills, which instead land as markdown under `~/.claude/rules`. Only the
 * `~/.claude/*` rows differ from legacy behavior.
 */
export const linkTargets: readonly LinkTarget[] = [
  { dir: '~/.codex/skills', kind: 'skill', include: linkedSkills },
  { dir: '~/.config/opencode/skills', kind: 'skill', include: linkedSkills },
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
