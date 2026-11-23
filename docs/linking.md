# Rendering and Linking

How `pnpm skills link` turns the sources in this checkout into installed skills,
rules, roles, and configuration entries for local agent tools, and how
`pnpm skills unlink` removes them.

## Configuration: `meta.template.ts` and `meta.ts`

- `meta.template.ts` contains the committed shared defaults.
- `meta.ts` is the Git-ignored local configuration for this machine. It is not
  tracked and is private to each checkout.
- Scripts read configuration through `scripts/lib/config.ts`: an existing
  `meta.ts` takes precedence; otherwise they use the template without creating
  files. Help, status, and project discovery therefore work on a fresh clone. An
  error in an existing `meta.ts` is reported rather than falling back to the
  template.
- `pnpm skills init` copies the template to `meta.ts` only when it is missing,
  then initializes the configured vendor submodules. To customize destinations
  before initializing submodules, copy the template first with
  `cp -n meta.template.ts meta.ts`.
- Edit `meta.ts` for this machine's skills, vendors, and tool destinations (for
  example, remove a tool's `linkTargets` rows when you do not use it). Edit
  `meta.template.ts` only to change shared defaults for future installations.
  Initialization and template updates never overwrite an existing `meta.ts`;
  merge shared changes yourself. See [Upgrading local meta.ts](upgrading-local-meta.md).
- Type definitions live in `scripts/lib/metaTypes.ts`. Skill names come from the
  `Skill` const object, not a TypeScript `enum`: Node runs these files in
  type-stripping mode, which rejects non-erasable syntax.

The main exports are:

| Export | Purpose |
| --- | --- |
| `localSkillSources` | Local directory or document sources rendered into `generated/<name>/`. |
| `vendors` | Upstream repositories under `vendor/` and the skills synced from them. See [Maintenance](maintenance.md#vendored-skills). |
| `agentOnlySkills` | Skills rendered for roles but omitted from every general skill directory. See [Roles and teams](roles-and-teams.md#role-only-skills). |
| `installableSkills` | Generated bundles that may be linked into agent skill directories (local and vendored sources minus `agentOnlySkills`). |
| `alwaysOnInstructionSkills` | Document-backed skills also delivered as always-on Markdown rules to Claude Code and OpenCode. |
| `linkTargets` | The per-destination table that `link` iterates. |

The template also derives two filtered lists used by `linkTargets`:

- `normalSkillNames`: `installableSkills` minus `alwaysOnInstructionSkills`.
  Used for Claude Code and OpenCode skill directories, which receive those
  rules through their rule directories instead.
- `contextHostSkills`: `installableSkills` minus `communication-rules`,
  `agent-routing`, `project-workspaces`, and `skill-feedback` (the template's
  `contextRuleSkills`). Used for Codex, Pi, Antigravity, and `~/.agents/skills`,
  which receive those four through managed global instruction sections. Their
  generated bundles still exist and are read by path when needed.

## Skill Sources and Rendering

Sources live under `skills/`, `rules/`, `knowledge/`, and selected `vendor/`
paths. `pnpm skills link` first renders every configured `localSkillSources`
entry into the Git-ignored `generated/` directory, renders roles into
`generated/agents/`, and then applies `linkTargets`. Never edit `generated/` by
hand; edit the source and re-run `pnpm skills link`.

- **Directory sources** (`kind: 'directory'`) are skill packages such as
  `skills/<name>/SKILL.md`. Rendering replaces `{{REPO_ROOT}}` with this
  checkout's absolute path throughout their Markdown files; scripts and binary
  assets are copied unchanged. A directory skill that needs files outside its
  own folder can reference them through `{{REPO_ROOT}}`.
- **Document sources** (`kind: 'document'`) wrap a single document, such as a
  rule set under `rules/` or the private `knowledge/INDEX.md`. The source stays
  where it is; rendering writes `generated/<name>/SKILL.md` with the configured
  title, description, and instructions, and resolves the document's relative
  links to absolute paths in this checkout.
- Every skill in `alwaysOnInstructionSkills` must be a document source; linking
  fails otherwise.
- `pnpm skills validate` checks every regular bundled file for missing, stale,
  or retired output, including references and assets.

Because rendered files contain absolute paths, moving the checkout requires
re-running `pnpm skills link`.

## Link Targets

Each `linkTargets` row names a destination directory or file, a `kind`, and
what it receives. The shared defaults are:

| Destination | Kind | Receives |
| --- | --- | --- |
| `~/.codex/AGENTS.md` | markdown-section | Full communication rules plus short discovery, routing, and feedback entries; prefers an existing nonempty `AGENTS.override.md`. |
| `~/.pi/agent/AGENTS.md` | markdown-section | Same four sections; prefers the first existing nonempty file among `AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, `CLAUDE.MD`. |
| `~/.gemini/GEMINI.md` | markdown-section | Same four sections for Antigravity. |
| `~/.gemini/config/skills` | skill | `contextHostSkills`; Antigravity App, CLI, and IDE. Sets `createIfParentExists`. |
| `~/.gemini/config/agents` | agent | Antigravity role definitions. |
| `~/.gemini/config/config.json` | json-array | Adds desktop `read_file` grants for `skills/`, `agents/`, `rules/`, and `generated/` under the checkout. |
| `~/.codex/skills` | skill | `contextHostSkills` |
| `~/.pi/agent/skills` | skill | `contextHostSkills` |
| `~/.kimi-code/skills` | skill | All `installableSkills`, including the shared rule skills. |
| `~/.config/opencode/skills` | skill | `normalSkillNames` |
| `~/.config/opencode/rules` | rule | `alwaysOnInstructionSkills` as `<skill>.md` |
| `~/.config/opencode/opencode.json` | json-array | Ensures `instructions` includes `~/.config/opencode/rules/*.md`. |
| `~/.config/opencode/opencode.json` | json-object | Sets entries under `permission.external_directory`: `'*': 'ask'`, `~/.config/opencode/**`, and the checkout's `skills/**`, `agents/**`, `rules/**`, and `generated/**` set to `allow`. |
| `~/.agents/skills` | skill | `contextHostSkills` |
| `~/.claude/agents` | agent | Claude Code role definitions. |
| `~/.kimi-code/agents` | agent | Kimi Code role definitions. |
| `~/.config/opencode/agents` | agent | OpenCode role definitions. |
| `~/.pi/agent/agents` | agent | Pi role definitions. |
| `~/.claude/skills` | skill | `normalSkillNames` |
| `~/.claude/rules` | rule | `alwaysOnInstructionSkills` as `<skill>.md` |

Notes on the kinds:

- **skill** rows symlink `generated/<name>/` into the directory and prune stale
  links that point into this checkout.
- **rule** rows symlink `<skill>.md` to the rendered
  `generated/<skill>/SKILL.md`. With the defaults, Claude Code and OpenCode
  therefore receive `communication-rules.md`, `agent-routing.md`,
  `engineering-rules.md`, `problem-solving-rules.md`, `project-workspaces.md`,
  and `skill-feedback.md`.
- **markdown-section** rows write a managed section delimited by markers. The
  content comes from the source file (frontmatter removed, `{{REPO_ROOT}}`
  expanded). Re-linking replaces the section in place without duplicating it.
  Edit the entry sources (`rules/*/ENTRY.md`) and full rules in this checkout,
  not the managed sections.
- **json-array** rows add missing string values to an array and leave other
  values and keys untouched. `{{REPO_ROOT}}` expands to the absolute checkout
  path.
- **json-object** rows set each key to its configured value at a nested object
  path and preserve unrelated keys. A key that already exists with a different
  value is overwritten. In particular, the OpenCode row sets `'*': 'ask'` in the
  user's global `opencode.json`, replacing any existing `'*'` value there. Keys
  containing `{{REPO_ROOT}}` are written as `~/...` paths when the checkout is
  under the home directory.
- **agent** rows link rendered roles; see [Roles and teams](roles-and-teams.md).

### When Destinations Are Created

- Skill directories are linked only when they already exist, unless the row
  sets `createIfParentExists: true`; then the directory is created only when its
  immediate parent exists. The Antigravity skill row opts in, so linking may
  create `~/.gemini/config/skills` but never `~/.gemini/config` itself.
- Rule directories, agent directories, JSON config files, and managed Markdown
  files are created or updated only when their parent directory exists.
- Missing default skill directories are skipped. For example, deleting
  `~/.agents/skills` keeps `pnpm skills link` from recreating it.

## Why Claude and OpenCode Get Rules Instead of Skills

Claude Code loads `~/.claude/rules/*.md` into every session, whereas skills are
invoked only at the model's discretion. Skills in `alwaysOnInstructionSkills`
are therefore linked as rules and excluded from `~/.claude/skills`. OpenCode
receives the same split, plus the `instructions` glob in `opencode.json`.

Codex, Pi, and Antigravity receive the communication rules in full and short
managed entries for project discovery, role routing, and skill feedback; those
entries load the full generated skill by path when needed. The engineering and
problem-solving rules remain ordinary skills there. Kimi Code receives every
shared rule as a discoverable skill and has no always-on entry in this
configuration. `personal-knowledge` stays a skill everywhere because it is
task-triggered by design.

## Host Notes

- **Antigravity:** see [Antigravity compatibility](antigravity.md) for official
  paths, the native role format, legacy paths, and runtime verification. The App
  and IDE use their own global skill directory; do not assume they read
  `~/.agents/skills`. Gemini CLI-specific installation and role generation are
  not configured.
- **Codex:** Codex documents `~/.agents/skills` as the user-level skill location
  and supports symlinked skill folders. Two linked skills with the same `name`
  are not merged and can both appear in skill selectors, so link a skill into
  only one Codex-scanned user location when possible.
- **Foreign installations:** the linker preserves symlinks it does not own and
  does not manage another tool's installation settings. `frontend-design` is
  maintained here as a UI-designer-only bundle; disable an independently
  installed global copy in its owning manager (for example, CC Switch) instead
  of overwriting it during `link`.

## Unlinking

```bash
pnpm skills unlink
```

`unlink` walks the same `linkTargets` and removes only what this repository
owns:

- skill, rule, and agent links that point into this checkout;
- managed Markdown sections (including any `preferExisting` alternatives),
  keeping the user's surrounding instructions and private workspace maps.

`unlink` does **not** remove json-array or json-object entries. The Antigravity
`read_file` grants, OpenCode's `instructions` glob, and OpenCode's
`permission.external_directory` entries stay in place. Remove them manually (or,
for the Antigravity grant, in the App's permission settings) if you no longer
want them.

## Explicit `--target`

```bash
pnpm skills link --target <path>
pnpm skills unlink --target <path>
```

`link --target` renders sources and roles, creates the directory if needed, and
links the full `installableSkills` list into it, without per-target filtering,
rule linking, agents, or configuration merges. It is not a complete
installation. `unlink --target` removes this repository's skill links and rule
links from that directory and leaves foreign links untouched.
