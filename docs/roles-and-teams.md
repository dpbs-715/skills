# Roles and Teams

## Role Sources

Each role lives in `agents/<name>/`:

- `AGENT.md` holds the role's mission and handoff instructions.
- `agent.json` declares the matching `name`, a delegation `description`,
  applicable `rules/` Markdown paths, skill names from `installableSkills`
  (`skills`), and optional `agentOnlySkills`.

Skills remain shared packages; a role lists the ones it normally uses. The list
is not a security boundary on tools that expose every installed skill to agents.
Repository workflow operations such as commits, pushes, and pull requests are
handled by the lead agent rather than assigned to `frontend-engineer`.

Keep role selection criteria and useful exclusions in `agent.json`'s
`description`; automatic routing reads them from the generated index.

## Role-Only Skills

A skill used only by a role is registered in `agentOnlySkills` in `meta.ts` and
in that role's `agentOnlySkills` list. Local sources stay under `skills/` and
are declared in `localSkillSources`; third-party sources are declared in
`vendors` and synced from `vendor/`. Both are rendered under `generated/` for
the role to read but omitted from every tool's general skill directory and from
Claude's `skills` preload field. This is discovery scoping, not filesystem
access control.

In the defaults, `before-you-build` belongs to `product-manager`, and the
selected visual design, zine, Three.js, and GSAP skills belong to the matching
specialist roles. A rule may also route the lead agent to a role-only skill by
path: the engineering rules do this for `before-you-build` when product demand,
value, or adoption is uncertain, without requiring delegation.

## Rendering and Installation

`pnpm skills link` renders each role to `generated/agents/<tool>/<name>.md` and
links it into the native agent directory of each configured host. Edit
`agents/`, never the generated files. Role rendering rebuilds its owned
`generated/agents/` tree, removing output for retired host formats.
`pnpm skills unlink` removes only links owned by this repository.

| Tool | Agent destination | Notes |
| --- | --- | --- |
| Claude Code | `~/.claude/agents` | The manifest's `skills` are preloaded through Claude's native `skills` field. |
| Kimi Code | `~/.kimi-code/agents` | Uses the shared Markdown agent definition. |
| OpenCode | `~/.config/opencode/agents` | Rendered with `mode: subagent`. |
| Pi | `~/.pi/agent/agents` | Requires a Pi subagent extension that reads this directory; Pi does not activate roles from files alone. |
| Antigravity | `~/.gemini/config/agents` | Rendered with `subagent: true` and `mainAgent: false`; the body lists explicit paths to role skills instead of assuming Claude-style preloading. No model, tool allowlist, or execution-policy override is installed. See [Antigravity compatibility](antigravity.md#native-role-format). |

Every rendered role links to its shared rules and agent-only skills.
Antigravity also links to ordinary role skills by path. Other hosts list them
by name, and Claude Code preloads them through its native `skills` field. No Codex native role files are generated.

## Role Index and Routing

The same `link` run generates the Git-ignored `generated/agents/INDEX.md` from
the role manifests, with each role's description and source paths. Re-run
`pnpm skills link` when roles change, are renamed, or are removed;
`pnpm skills validate` reports a stale or missing index.

The [agent-routing rules](../rules/agent-routing/RULES.md) decide when a task
needs a role, how to load it, and when to delegate. Role selection remains a
model judgment, not a deterministic keyword dispatcher, and the deduplication
of already loaded configuration is a model instruction rather than a
programmatic recursion lock.

Codex, Pi, and Antigravity receive the short `rules/agent-routing/ENTRY.md` in
a managed section of their global instruction file, which directs relevant tasks
to the full generated skill by path. Claude Code and OpenCode receive the full
rules through their always-loaded rule directories. Kimi Code receives them as a
discoverable skill without an always-loaded routing entry. On hosts without
native role selection, delegation uses the available subagent tools with
explicit role configuration paths. See [Rendering and linking](linking.md).

## Teams

The [team-workflow skill](../skills/team-workflow/SKILL.md) forms an ad hoc team
for user-requested collaboration or for delegation requested by the routing
rules. Direct use of a role does not require it. It binds each subagent to an
installed role or passes the role's instructions, rules, and skill paths to a
generic subagent, checks prerequisite outputs before dependent work, verifies
the combined result, and reports each subagent's role, work, deliverables,
checks, and status.

### Team Templates

There are currently no saved team templates; see [teams/README.md](../teams/README.md).
Templates are saved only when a workflow has proved reusable and the user asks
to keep it.

A template is `teams/<name>/team.json` plus a `TEAM.md` that explains when to
choose it and how to integrate its results. Each task in `team.json` has `id`,
`agent`, `goal`, and `dependsOn`. A task may start only after every task in
`dependsOn` has finished and its output has been checked. Ready independent
tasks may run concurrently; a dependency chain runs in order. Templates do not
install as native agent profiles.

`pnpm skills validate` rejects saved templates with unknown agents, missing
dependencies, duplicate task IDs, or dependency cycles.
