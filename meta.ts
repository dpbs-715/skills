import type { LinkTarget, LocalSkillSource, VendorSkillMeta } from './scripts/lib/metaTypes.ts'

// Use a const object instead of enum because Node strips types only for erasable syntax.
export const Skill = {
    CreatePageDesc: 'create-page-desc',
    CreateIssues: 'create-issues',
    CreatePr: 'create-pr',
    Cpush: 'cpush',
    Commit: 'commit',
    Dcr: 'dcr',
    EngineeringRules: 'engineering-rules',
    Mock: 'mock',
    MorandiCinematicPoster: 'morandi-cinematic-poster-zeejay',
    PersonalKnowledge: 'personal-knowledge',
    ProblemSolvingRules: 'problem-solving-rules',
    Push: 'push',
    SceneDistillationZine: 'scene-distillation-zine-v1-3',
    ScenesGatheredZine: 'scenes-gathered-zine-v1-3',
    ThreejsAnimation: 'threejs-animation',
    ThreejsFundamentals: 'threejs-fundamentals',
    ThreejsGeometry: 'threejs-geometry',
    ThreejsInteraction: 'threejs-interaction',
    ThreejsLighting: 'threejs-lighting',
    ThreejsLoaders: 'threejs-loaders',
    ThreejsMaterials: 'threejs-materials',
    ThreejsPostprocessing: 'threejs-postprocessing',
    ThreejsShaders: 'threejs-shaders',
    ThreejsTextures: 'threejs-textures',
    ZentaoBugList: 'zentao-bug-list',
    ZentaoFixBug: 'zentao-fix-bug',
    ZentaoInit: 'zentao-init',
} as const

export const localSkillSources = [
    { kind: 'directory', name: Skill.CreatePageDesc, path: 'skills/create-page-desc' },
    { kind: 'directory', name: Skill.CreateIssues, path: 'skills/create-issues' },
    { kind: 'directory', name: Skill.CreatePr, path: 'skills/create-pr' },
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
    { kind: 'directory', name: Skill.ZentaoBugList, path: 'skills/zentao-bug-list' },
    { kind: 'directory', name: Skill.ZentaoFixBug, path: 'skills/zentao-fix-bug' },
    { kind: 'directory', name: Skill.ZentaoInit, path: 'skills/zentao-init' },
] as const satisfies readonly LocalSkillSource[]

const vendoredSkillNames = [
    Skill.MorandiCinematicPoster,
    Skill.SceneDistillationZine,
    Skill.ScenesGatheredZine,
    Skill.ThreejsAnimation,
    Skill.ThreejsFundamentals,
    Skill.ThreejsGeometry,
    Skill.ThreejsInteraction,
    Skill.ThreejsLighting,
    Skill.ThreejsLoaders,
    Skill.ThreejsMaterials,
    Skill.ThreejsPostprocessing,
    Skill.ThreejsShaders,
    Skill.ThreejsTextures,
] as const

export const installableSkills = [
    ...localSkillSources.map(source => source.name),
    ...vendoredSkillNames,
]

export const alwaysOnInstructionSkills = [
    Skill.EngineeringRules,
    Skill.ProblemSolvingRules,
] as const

const alwaysOnInstructionSet = new Set<string>(alwaysOnInstructionSkills)
const normalSkillNames = installableSkills.filter(name => !alwaysOnInstructionSet.has(name))

export const linkTargets: readonly LinkTarget[] = [
    { dir: '~/.codex/skills', kind: 'skill', include: installableSkills },
    { dir: '~/.pi/agent/skills', kind: 'skill', include: installableSkills },
    { dir: '~/.kimi-code/skills', kind: 'skill', include: normalSkillNames },
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
    {
        entries: [
            { key: '*', value: 'ask' },
            { key: '~/.config/opencode/**', value: 'allow' },
            { key: '{{REPO_ROOT}}/skills/**', value: 'allow' },
            { key: '{{REPO_ROOT}}/rules/**', value: 'allow' },
        ],
        file: '~/.config/opencode/opencode.json',
        kind: 'json-object',
        path: ['permission', 'external_directory'],
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
    'gathered-scenes-zine-skill': {
        source: 'https://github.com/Zeejay0/gathered-scenes-zine-skill.git',
        skills: {
            'morandi-cinematic-poster-zeejay': Skill.MorandiCinematicPoster,
            'scene-distillation-zine-v1-3': Skill.SceneDistillationZine,
            'scenes-gathered-zine-v1-3': Skill.ScenesGatheredZine,
        },
    },
    'threejs-skills': {
        source: 'https://github.com/CloudAI-X/threejs-skills.git',
        skills: {
            'threejs-animation': Skill.ThreejsAnimation,
            'threejs-fundamentals': Skill.ThreejsFundamentals,
            'threejs-geometry': Skill.ThreejsGeometry,
            'threejs-interaction': Skill.ThreejsInteraction,
            'threejs-lighting': Skill.ThreejsLighting,
            'threejs-loaders': Skill.ThreejsLoaders,
            'threejs-materials': Skill.ThreejsMaterials,
            'threejs-postprocessing': Skill.ThreejsPostprocessing,
            'threejs-shaders': Skill.ThreejsShaders,
            'threejs-textures': Skill.ThreejsTextures,
        },
    },
}
