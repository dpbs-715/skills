# Personal Agent Skills

Personal rules, skills, and specialist roles for AI coding agents (Claude Code,
Codex, OpenCode, Pi, Kimi Code, and Antigravity). Sources live in this checkout;
`pnpm skills link` renders them and installs them into each tool.

## Install on Another Computer

Give a local coding agent the [copyable installation prompt](docs/local-setup-prompt.md).
It covers environment checks, first-time knowledge index creation, existing tool
configuration, linking, and verification, and includes the repository URL.

Configuration is local: `meta.template.ts` holds the committed defaults and the
Git-ignored `meta.ts` holds this machine's choices. `pnpm skills init` creates
`meta.ts` only when it is missing. See [Rendering and linking](docs/linking.md)
and, when updating an older checkout, [Upgrading local meta.ts](docs/upgrading-local-meta.md).

## Repository Layout

| Path | Contents |
| --- | --- |
| `rules/` | Durable rule sets (`RULES.md`, optional `ENTRY.md`, `topics/`). |
| `skills/` | Hand-written repo-owned skill packages (`skills/<name>/SKILL.md`). |
| `agents/` | Role definitions: `AGENT.md` instructions plus an `agent.json` manifest. |
| `teams/` | Reusable team templates (currently none). |
| `knowledge/` | Private, Git-ignored notes and index for `personal-knowledge`. |
| `vendor/` | Third-party skill submodules and committed snapshots. |
| `generated/` | Git-ignored rendered skills and roles. Never edit by hand. |
| `local/` | Git-ignored private state: project maps, Apifox credentials, server inventory, skill-feedback reports. |
| `scripts/` | The `pnpm skills` CLI, its commands, shared library, and tests. |
| `docs/` | Focused documentation (linked below). |

## Skills

| Skill | Purpose |
| --- | --- |
| [apifox](skills/apifox/SKILL.md) | Work with APIs, branches, imports/exports, and tests in explicitly bound Apifox projects. |
| [apifox-init](skills/apifox-init/SKILL.md) | Bind projects to local credential aliases and keep tokens in the private credential store. |
| [commit](skills/commit/SKILL.md) | Create focused commits with Conventional Commit messages. |
| [cpush](skills/cpush/SKILL.md) | Commit and push through the existing commit and push workflows. |
| [create-issues](skills/create-issues/SKILL.md) | Create GitHub or GitLab issues and associated branches. |
| [create-page-desc](skills/create-page-desc/SKILL.md) | Turn page references or requirements into structured specifications. |
| [create-pr](skills/create-pr/SKILL.md) | Open GitHub pull requests or GitLab merge requests. |
| [dcr](skills/dcr/SKILL.md) | Review local Git diffs and report actionable findings. |
| [mock](skills/mock/SKILL.md) | Simulate a request flow and identify applicable tools, skills, and rules. |
| [project-init](skills/project-init/SKILL.md) | Register, inspect, or update related local repositories without moving them. |
| [psql](skills/psql/SKILL.md) | Query and manage PostgreSQL in explicitly bound local CLI services. |
| [psql-init](skills/psql-init/SKILL.md) | Configure a project's PostgreSQL connection mapping. |
| [push](skills/push/SKILL.md) | Push local commits to a remote. |
| [review-pr](skills/review-pr/SKILL.md) | Review PRs/MRs and merge when the required checks pass. |
| [server-ops](skills/server-ops/SKILL.md) | Inspect logs, diagnose incidents, and perform authorized maintenance through local SSH. |
| [submit](skills/submit/SKILL.md) | Take existing changes through an Issue, branch, commit/push, and PR/MR, optionally reviewing and merging. |
| [team-workflow](skills/team-workflow/SKILL.md) | Coordinate repository roles and report each subagent's contributions. |
| [typesafe-ai](vendor/typesafe-ai-skills/skills/typesafe-ai/SKILL.md) | Build typed AI decision workflows with TypeSafe's System One models (vendored). |
| [zentao-bug-list](skills/zentao-bug-list/SKILL.md) | List, filter, and prioritize Bugs within the project's ZenTao scope. |
| [zentao-fix-bug](skills/zentao-fix-bug/SKILL.md) | Investigate and fix one scoped ZenTao Bug. |
| [zentao-init](skills/zentao-init/SKILL.md) | Configure or validate a project's ZenTao mapping. |

### Rules and Knowledge

These documents are rendered as skills. Claude Code and OpenCode also load
the configured always-on rules. Codex, Pi, and Antigravity receive four of
those rules through managed instructions. See [Rendering and linking](docs/linking.md).

| Skill | Source | Purpose |
| --- | --- | --- |
| `agent-routing` | [rules/agent-routing](rules/agent-routing/RULES.md) | Select specialist roles, load their capabilities, and delegate when useful. |
| `communication-rules` | [rules/communication](rules/communication/RULES.md) | Explain conclusions, terminology, actions, and verification clearly. |
| `engineering-rules` | [rules/engineering](rules/engineering/RULES.md) | Guide scope, implementation, structure, and code review. |
| `problem-solving-rules` | [rules/problem-solving](rules/problem-solving/RULES.md) | Investigate symptoms and address root causes. |
| `project-workspaces` | [rules/project-workspaces](rules/project-workspaces/RULES.md) | Discover related repositories before work and load their instructions. |
| `skill-feedback` | [rules/skill-feedback](rules/skill-feedback/RULES.md) | Record reproducible defects in maintained skills, rules, and roles locally. |
| `personal-knowledge` | Local `knowledge/INDEX.md` | Find private reusable notes through a lightweight index. |

## Roles

| Role | Responsibility | Role-only skills |
| --- | --- | --- |
| [Product manager](agents/product-manager/AGENT.md) | Clarify needs, scope, and acceptance criteria. | [before-you-build](skills/before-you-build/SKILL.md) |
| [UI designer](agents/ui-designer/AGENT.md) | Design hierarchy, layouts, component states, responsive behavior, and handoff. | [visual-design-foundations](vendor/ui-designer-skills/visual-design-foundations/SKILL.md), [frontend-design](vendor/ui-designer-skills/frontend-design/SKILL.md) |
| [Frontend engineer](agents/frontend-engineer/AGENT.md) | Implement and review frontend components and interactions. | — |
| [Visual artist](agents/visual-artist/AGENT.md) | Create visual artwork and poster concepts. | `scenes-gathered-zine-v1-3`, `scene-distillation-zine-v1-3` |
| [Three.js engineer](agents/threejs-engineer/AGENT.md) | Build and verify Three.js scenes, animation, and interaction. | `threejs-fundamentals`, `threejs-interaction`, `threejs-animation` |
| [Motion engineer](agents/motion-engineer/AGENT.md) | Implement GSAP motion, timelines, scrolling, and framework integration. | `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-frameworks`, `gsap-react` |

Role-only skills are rendered for their roles but kept out of global skill
directories. Unlinked names come from vendor submodules that appear after
`pnpm skills init`. `team-workflow` assembles a team per task; there are no
saved team templates. See [Roles and teams](docs/roles-and-teams.md).

## Integrations

Details and private-state locations: [Integrations](docs/integrations.md).

- **Related projects:** `project-init` saves workspace maps under
  `local/project-workspaces/`; the [project workspace rules](rules/project-workspaces/RULES.md)
  run read-only discovery at session start. Contract: [workspaces.md](skills/project-init/references/workspaces.md).
- **ZenTao, PostgreSQL, and Apifox bindings:** shared workspace resources with
  per-repository legacy files as fallback. Contract: [integrations.md](skills/project-init/references/integrations.md).
- **Apifox:** tokens stay in `local/apifox/credentials.json`. See the
  [connection contract](skills/apifox-init/references/connection.md).
- **Server operations:** plain local OpenSSH with an optional inventory in
  `local/server-ops/servers.yaml`. See [server-ops](skills/server-ops/SKILL.md)
  and its [authentication guide](skills/server-ops/references/authentication.md).
- **Skill feedback:** agents save reproducible skill defects as private local
  reports once enabled. See the [rule](rules/skill-feedback/RULES.md) and
  [Maintenance](docs/maintenance.md#skill-feedback).

## Commands

Everything runs through `pnpm skills <command>`; run `pnpm skills` with no
arguments for this list.

```bash
pnpm skills status    # show configured skills, their roles, and submodule state
pnpm skills link      # render sources and install skills, rules, roles, and config entries
pnpm skills unlink    # remove links and managed sections created by this repo
pnpm skills sync      # update submodules, then sync vendored skills into generated/
pnpm skills init      # create local meta.ts if missing, then initialize vendor submodules
pnpm skills check     # fetch submodules and report upstream updates
pnpm skills cleanup   # report unused submodules/generated skills (pass --yes to remove)
pnpm skills validate  # validate local sources, generated skills, and metadata
pnpm skills note      # manage private knowledge notes (list, reindex, add)
pnpm skills feedback  # enable, disable, check, or save private local skill feedback
pnpm skills project   # discover related repositories and manage private workspace maps
```

Code checks: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Documentation

- [Local setup prompt](docs/local-setup-prompt.md): install on a new machine.
- [Rendering and linking](docs/linking.md): `meta.ts`, skill lists, link targets, `link`/`unlink`.
- [Roles and teams](docs/roles-and-teams.md): role manifests, per-host rendering, routing, team templates.
- [Integrations](docs/integrations.md): project workspaces, bindings, ZenTao, PostgreSQL, Apifox, server ops.
- [Maintenance](docs/maintenance.md): conventions, vendored skills, validation, cleanup, notes, feedback.
- [Upgrading local meta.ts](docs/upgrading-local-meta.md): merging new template defaults.
- [Antigravity compatibility](docs/antigravity.md): paths, role format, and verification.
- [Skill evaluations](docs/skill-evaluations.md): fixture checks vs. model behavior evaluations.
- [AGENTS.md](AGENTS.md): maintenance notes for agents editing this repository.
