# Personal Agent Skills

Personal rules and skills for AI coding agents.

## Install on Another Computer

Give a local coding agent the [copyable installation prompt](docs/local-setup-prompt.md). It covers environment checks, first-time knowledge index creation, existing tool configuration, linking, and verification. The prompt includes the repository URL and can be forwarded on its own.

## Repository Layout

This repository separates always-on preferences from task-specific skills:

- `rules/` contains durable personal or project rules that should guide broad work.
- `skills/` contains hand-written repo-owned skill packages.
- `agents/` contains reusable role definitions. Each role has an `agent.json` manifest and an `AGENT.md` instruction body.
- `teams/` may contain reusable workflows once a task pattern has proven useful. Each task in `team.json` names an agent and its prerequisite task IDs.
- `generated/` contains rendered agent definitions and rendered or synced installable skill bundles that are symlinked into tool directories.
- `vendor/` contains synchronized third-party skill repositories.
- `meta.ts` is the link configuration: which local directory or document sources render into `generated/` (`localSkillSources`), which generated bundles link into agents (`installableSkills`), which document-backed skills are also delivered as always-on instructions (`alwaysOnInstructionSkills`), the per-destination link/config table (`linkTargets`), and vendored skill mappings. Type definitions live in `scripts/lib/metaTypes.ts`.

## Current Entries

This inventory covers the skills configured in `meta.ts` and every repository role. Links point to source entries; installable bundles are rendered or synced into `generated/`.

### General Skills

| Skill | Purpose |
| --- | --- |
| [commit](skills/commit/SKILL.md) | Create focused commits with Conventional Commit messages. |
| [cpush](skills/cpush/SKILL.md) | Commit and push through the existing commit and push workflows. |
| [create-issues](skills/create-issues/SKILL.md) | Create GitHub or GitLab issues and associated branches. |
| [create-page-desc](skills/create-page-desc/SKILL.md) | Turn page references or requirements into structured specifications. |
| [create-pr](skills/create-pr/SKILL.md) | Open GitHub pull requests or GitLab merge requests. |
| [dcr](skills/dcr/SKILL.md) | Review local Git diffs and report actionable findings. |
| [mock](skills/mock/SKILL.md) | Simulate a request flow and identify applicable tools, skills, and rules. |
| [psql](skills/psql/SKILL.md) | Query and manage PostgreSQL through local CLI connections. |
| [psql-init](skills/psql-init/SKILL.md) | Configure a project's PostgreSQL connection mapping. |
| [push](skills/push/SKILL.md) | Push local commits to a remote. |
| [review-pr](skills/review-pr/SKILL.md) | Review PRs/MRs and merge when the required checks pass. |
| [submit](skills/submit/SKILL.md) | Run the issue, branch, commit/push, and PR/MR submission workflow. |
| [team-workflow](skills/team-workflow/SKILL.md) | Coordinate repository roles and report each subagent's contributions. |
| [zentao-bug-list](skills/zentao-bug-list/SKILL.md) | List, filter, and prioritize bugs within the project's ZenTao scope. |
| [zentao-fix-bug](skills/zentao-fix-bug/SKILL.md) | Investigate and fix one scoped ZenTao bug. |
| [zentao-init](skills/zentao-init/SKILL.md) | Configure or validate a project's ZenTao mapping. |

### Rules and Knowledge

These document sources are rendered as skills. Engineering and problem-solving rules also become always-on instructions for configured tools that use rule directories.

| Skill | Source | Purpose |
| --- | --- | --- |
| `engineering-rules` | [Engineering rules](rules/engineering/RULES.md) | Guide implementation, structure, and code review. |
| `problem-solving-rules` | [Problem-solving rules](rules/problem-solving/RULES.md) | Investigate symptoms and address root causes. |
| `personal-knowledge` | Local `knowledge/INDEX.md`; see [Knowledge Notes](#knowledge-notes) | Find private reusable notes through a lightweight index. |

The knowledge index and notes are gitignored. Run `pnpm skills note reindex` to create the index on a fresh checkout.

### Role-Only Skills

These skills are available to their owning roles and are omitted from global skill directories. Vendored submodule sources become available locally after `pnpm skills init`; only the selected skills below are configured for use.

| Skill | Owning role | Source |
| --- | --- | --- |
| `before-you-build` | Product manager | [Local skill](skills/before-you-build/SKILL.md) |
| `visual-design-foundations` | UI designer | [Vendored snapshot](vendor/ui-designer-skills/visual-design-foundations/SKILL.md) |
| `frontend-design` | UI designer | [Vendored snapshot](vendor/ui-designer-skills/frontend-design/SKILL.md) |
| `scenes-gathered-zine-v1-3` | Visual artist | [Vendored skill](vendor/gathered-scenes-zine-skill/skills/scenes-gathered-zine-v1-3/SKILL.md) |
| `scene-distillation-zine-v1-3` | Visual artist | [Vendored skill](vendor/gathered-scenes-zine-skill/skills/scene-distillation-zine-v1-3/SKILL.md) |
| `threejs-fundamentals` | Three.js engineer | [Vendored skill](vendor/threejs-skills/skills/threejs-fundamentals/SKILL.md) |
| `threejs-interaction` | Three.js engineer | [Vendored skill](vendor/threejs-skills/skills/threejs-interaction/SKILL.md) |
| `threejs-animation` | Three.js engineer | [Vendored skill](vendor/threejs-skills/skills/threejs-animation/SKILL.md) |
| `gsap-core` | Motion engineer | [Vendored skill](vendor/gsap-skills/skills/gsap-core/SKILL.md) |
| `gsap-timeline` | Motion engineer | [Vendored skill](vendor/gsap-skills/skills/gsap-timeline/SKILL.md) |
| `gsap-scrolltrigger` | Motion engineer | [Vendored skill](vendor/gsap-skills/skills/gsap-scrolltrigger/SKILL.md) |
| `gsap-frameworks` | Motion engineer | [Vendored skill](vendor/gsap-skills/skills/gsap-frameworks/SKILL.md) |

### Role Agents

| Role | Responsibility |
| --- | --- |
| [Product manager](agents/product-manager/AGENT.md) | Clarify needs, scope, and acceptance criteria. |
| [UI designer](agents/ui-designer/AGENT.md) | Design page hierarchy, layouts, component states, responsive behavior, and visual handoff. |
| [Frontend engineer](agents/frontend-engineer/AGENT.md) | Implement and review frontend components and interactions. |
| [Visual artist](agents/visual-artist/AGENT.md) | Create visual artwork and poster concepts. |
| [Three.js engineer](agents/threejs-engineer/AGENT.md) | Build and verify Three.js scenes, animation, and interaction. |
| [Motion engineer](agents/motion-engineer/AGENT.md) | Implement GSAP motion, timelines, scrolling, and framework integration. |

Each role has an `agent.json` manifest beside its `AGENT.md` source. There are currently no saved [team templates](teams/README.md); `team-workflow` assembles a team for each task.

Run `pnpm skills status` for the live view derived from `meta.ts`: which skills are configured (and why), whether each generated bundle is present in `generated/`, any undeclared generated skill directories, and submodule checkout state.

Run `pnpm skills validate` to check that configured local sources, generated skills and agents, team dependencies, skill frontmatter, and repo-local absolute references are still consistent.

## Vendored Skills

This repository follows the same broad pattern as `antfu/skills` for projects that already maintain their own skills:

1. Declare the upstream repository and skills to copy in `meta.ts` under `vendors`.
2. Run the skills manager to add missing submodules.
3. Sync selected upstream skills into `generated/`.

For a configured vendored source, the normal flow is:

```bash
pnpm skills init
pnpm skills sync
pnpm skills link
```

Everything is one command — `pnpm skills <command>`:

```bash
pnpm skills status    # show configured skills, their roles, and submodule state
pnpm skills link      # symlink configured skills into local agent skill directories
pnpm skills unlink    # remove skill symlinks created by this repo
pnpm skills sync      # update submodules, then sync vendored skills into generated/
pnpm skills init      # add missing vendor git submodules from meta.ts
pnpm skills check     # fetch submodules and report upstream updates
pnpm skills cleanup   # report unused submodules/generated skills (pass --yes to remove)
pnpm skills validate  # validate local sources, generated skills, and metadata
pnpm skills note      # manage private knowledge notes (list, reindex, add)
```

Run `pnpm skills` with no arguments to see this list.

Manual vendor setup is still possible when you want to add a submodule yourself:

1. Add the upstream repository under `vendor/<name>`.
2. Declare the skills to copy in `meta.ts` under `vendors`.
3. Run the vendor sync script directly.

```bash
git submodule add https://github.com/greensock/gsap-skills.git vendor/gsap-skills
pnpm skills sync
pnpm skills link
```

Synced skills in `generated/` get a `SYNC.md` file with the upstream path, repository URL, git SHA, and sync date. Avoid editing synced skill directories by hand; update the vendor submodule and re-run `pnpm skills sync` instead.

## Conventions

Rule sets use `RULES.md` as the entry file and keep focused topic documents in `topics/`.

Hand-written repo-owned skills should use the standard `SKILL.md` layout under `skills/<name>/`.

## Role Agents

Keep each role's mission and handoff instructions in `agents/<name>/AGENT.md`. Its `agent.json` declares the matching `name`, a delegation `description`, applicable `rules/` Markdown paths, and skill names from `installableSkills`. Skills remain shared packages; the role lists the ones it normally uses. The list is not a security boundary on tools that expose every installed skill to agents.

The `skills` list is preloaded by Claude Code and shown as a role skill everywhere. Repository workflow operations such as commits, pushes, and pull requests are handled by the lead agent rather than assigned to `frontend-engineer`.

For a skill used only by a role, register its name in `agentOnlySkills` in `meta.ts` and in that role's `agentOnlySkills` list. Local sources stay under `skills/` and are declared in `localSkillSources`; third-party sources are declared in `vendors` and synced from `vendor/`. Both are rendered under `generated/` for the role to read, but omitted from every tool's general skill directory and from Claude's `skills` preload field. `before-you-build` belongs to `product-manager`; the selected visual, Three.js, and GSAP skills belong to specialist roles. This is discovery scoping, not filesystem access control.

`pnpm skills link` renders each role to `generated/agents/<tool>/<name>.md` and links it into the native agent directory for Claude Code, Kimi Code, OpenCode, and Pi. Claude receives its native `skills` preload field; OpenCode receives `mode: subagent`; the other fields and body are shared. `pnpm skills unlink` removes only links owned by this repository. Edit `agents/`, never the generated files.

| Tool | Agent destination | Notes |
| --- | --- | --- |
| Claude Code | `~/.claude/agents` | Skills in the manifest are preloaded. |
| Kimi Code | `~/.kimi-code/agents` | Uses the shared Markdown agent definition. |
| OpenCode | `~/.config/opencode/agents` | Generated role runs as a subagent. |
| Pi | `~/.pi/agent/agents` | Requires a Pi subagent extension that reads this directory; Pi does not activate roles from files alone. |

The `team-workflow` skill forms an ad hoc team for the current task. It explicitly binds each subagent to an installed role or passes the role's instructions, rules, and relevant skill paths to a generic subagent. The lead agent checks prerequisite outputs before starting dependent work and verifies the combined result. Completion reports map each subagent task to the repository role actually used, work completed, deliverables, checks, and status. Reusable templates are saved only when the user asks.

## Team Templates

When a workflow proves reusable, save it as `teams/<name>/team.json` with tasks containing `id`, `agent`, `goal`, and `dependsOn`. A task may start only after every task in `dependsOn` finishes and its output is checked. Ready independent tasks may run concurrently; a dependency chain runs linearly. `TEAM.md` explains when to choose the template and how to integrate its results. Templates are optional and do not install as native agent profiles. `pnpm skills validate` rejects unknown agents, missing dependencies, duplicate task IDs, and cycles in saved templates.

Document-backed skills, such as rule wrappers or the personal knowledge index wrapper, are declared in `localSkillSources` in `meta.ts`. Their source content stays in `rules/` or `knowledge/`; `pnpm skills link` renders it into gitignored `generated/<name>/SKILL.md` files and resolves relative document links to absolute paths in this checkout.

A directory skill that must reference files outside its own folder can still use the `{{REPO_ROOT}}` placeholder. Edit `skills/<name>/SKILL.md`, never the generated copy, and re-run `pnpm skills link` to regenerate.

Add a skill name to `installableSkills` in `meta.ts` when its generated bundle should be symlinked into local agent skill directories. Add it to `alwaysOnInstructionSkills` when its rendered `generated/<name>/SKILL.md` should also reach Claude or opencode as an always-loaded markdown instruction under their rule directories.

## Knowledge Notes

Private reusable notes live under `knowledge/notes/`, with `knowledge/INDEX.md` as the lightweight index used by the `personal-knowledge` skill. These files are gitignored by default.

Use the note workflow to keep that index fresh:

```bash
pnpm skills note list
pnpm skills note reindex
pnpm skills note add command-notes/example --title "Example" --summary "Short reusable note." --tag commands
```

`note reindex` scans markdown files under `knowledge/notes/`, skips hidden directories such as `.obsidian`, preserves existing summaries and tags when possible, and rewrites `knowledge/INDEX.md`. `note add` creates a new note and refuses to overwrite an existing one.

## Linking Skills

The repository keeps local sources under `skills/`, `rules/`, and `knowledge/`, then renders generated bundles under `generated/`. Link configured `installableSkills` into local agent skill directories with:

```bash
pnpm skills link
```

By default this first renders configured `localSkillSources`, then applies the `linkTargets` table from `meta.ts`. Each row is a destination/config file, a `kind`, and what it receives:

| Destination | Kind | Receives |
| --- | --- | --- |
| `~/.codex/skills` | skill | all `installableSkills` |
| `~/.config/opencode/skills` | skill | `installableSkills` minus `alwaysOnInstructionSkills` |
| `~/.config/opencode/rules` | rule | `alwaysOnInstructionSkills`, linked as `<skill>.md` markdown |
| `~/.config/opencode/opencode.json` | json-array | ensures `instructions` includes `~/.config/opencode/rules/*.md` |
| `~/.agents/skills` | skill | all `installableSkills` |
| `~/.claude/skills` | skill | `installableSkills` minus `alwaysOnInstructionSkills` |
| `~/.claude/rules` | rule | `alwaysOnInstructionSkills`, linked as `<skill>.md` markdown |

Skill directories are populated only when they already exist (the tool is installed); missing ones are skipped, not created. Rule directories and JSON config files are created when their parent agent config directory exists.

### Why Claude gets rules instead of skills

Claude auto-loads `~/.claude/rules/*.md` into context every session, whereas skills are invoked only at the model's discretion. Skills listed in `alwaysOnInstructionSkills` (currently the engineering and problem-solving rule sets) are therefore linked into `~/.claude/rules` as markdown pointing at the repo's `RULES.md`, and excluded from `~/.claude/skills`, so they always apply when Claude works. opencode receives the same split, but its `opencode.json` also needs an `instructions` glob for the rules directory; the `json-array` row keeps that configured. Codex and Agents read the rule sets as skills via `~/.codex/skills` / `~/.agents/skills` and are unaffected. `personal-knowledge` stays a skill everywhere — it is task-triggered by design.

Codex documents `~/.agents/skills` as the user-level skill location and supports symlinked skill folders. If two linked skills share the same `name`, Codex does not merge them; both can appear in skill selectors. To avoid duplicate entries, link a skill into only one Codex-scanned user location when possible.

Missing default target directories are skipped, so deleting `~/.agents/skills` keeps `pnpm skills link` from recreating it. Use `--target <path>` when you want to create or update a specific target directory explicitly.

Remove links created by this repository with:

```bash
pnpm skills unlink
```

Use `--target <path>` to link or unlink a specific target directory.
