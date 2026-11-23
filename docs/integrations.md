# Integrations

The skills below connect agents to external services or to other local
repositories. Each skill and its references own the detailed workflow; this page
only explains how the pieces fit together and where private state lives.

Workspace maps and stored credentials stay in this checkout's Git-ignored
`local/` directory or in the tools' own local stores. A member without an
explicit workspace binding can still read its repository-local binding file.

| Private state | Location |
| --- | --- |
| Related-project maps | `local/project-workspaces/<name>.yaml` |
| Apifox tokens | `local/apifox/credentials.json` |
| Server inventory | `local/server-ops/servers.yaml` |
| Legacy per-repository bindings | `.zentao`, `.psql`, `.apifox/projects.json` in a repository with no workspace binding for that integration |

## Related Projects (Project Workspaces)

- Workflow and schema: [project-init skill](../skills/project-init/SKILL.md) and
  its [workspace contract](../skills/project-init/references/workspaces.md).
- Session discovery: [project workspace rules](../rules/project-workspaces/RULES.md).

Run `project-init` explicitly from any member repository to associate frontend,
backend, and mobile projects at their existing locations, for example:

```text
/project-init Associate this frontend with /work/scm-api and /mobile/scm
/project-init Check this project's associations and available agent entry points
```

One map per workspace is saved under `local/project-workspaces/`. Maps are not
installed inside the skill bundle and are not copied to member repositories or
`~/.config`. Maps contain project paths, descriptions, optional directional
`uses` relationships, optional `resources`, and explicit per-member `bindings`.
Target instructions, skills, roles, MCP configuration candidates, and Serena
settings are discovered from live files when needed; discovery does not connect
tools, copy credentials, or expand permissions.

After `pnpm skills link`, Codex, Pi, and Antigravity receive the short
`rules/project-workspaces/ENTRY.md` in a managed global instruction section, and
Claude Code and OpenCode receive `project-workspaces.md` in their rule
directories (see [Rendering and linking](linking.md)). These are model
instructions to run read-only discovery before the first substantive task, not
enforced startup hooks; native instruction loading and host permissions still
govern execution. Discovery matches repository roots, subdirectories, symlinks,
and Git worktrees; unregistered repositories continue normally, and missing
members stay listed as unavailable. Map changes are read live without
re-linking; moving this skills checkout requires re-linking its absolute paths.

The helper commands emit JSON and can be used directly:

```bash
pnpm skills project list
pnpm skills project discover --cwd /work/scm-web
pnpm skills project inspect --cwd /work/scm-api
pnpm skills project save --input /tmp/scm.yaml
# Explicitly replace an existing valid map after preparing its complete content:
pnpm skills project save --input /tmp/scm.yaml --replace
```

## Workspace Integration Bindings

- Contract: [integration contract](../skills/project-init/references/integrations.md).
- Code: `scripts/lib/projectBindings.ts` resolves sources and
  `scripts/lib/integrationContracts.ts` validates them.

ZenTao, PostgreSQL, and Apifox share one binding resolver. Definitions live in
`resources.<kind>.<name>` of a workspace map, and members reference them through
`bindings.<kind>`. A shared resource can serve several members; `uses` alone
does not inherit a binding. Resource values keep the existing per-integration
schemas. Logins, database routing and authentication, and actual tokens remain
in their machine-local stores.

An explicit workspace reference is authoritative. Members without one keep
using their legacy file (`.zentao`, `.psql`, or `.apifox/projects.json`). The
init skills save to the selected workspace when the member is registered;
ordinary queries and check-only requests never migrate anything. Malformed maps
and invalid references fail instead of falling back to legacy files, explicit
imports keep the legacy file's bytes, and concurrent or stale map writes are
rejected rather than overwriting another integration's changes.

```bash
pnpm skills project binding psql --cwd /work/scm-api
pnpm skills project binding-save psql --cwd /work/scm-api --workspace scm --resource backend --input /tmp/pg-binding.json
pnpm skills project binding-import zentao --cwd /work/scm-api --workspace scm --resource main
```

## ZenTao

[zentao-init](../skills/zentao-init/SKILL.md) binds a repository to a ZenTao
server, one required project, and an optional product.
[zentao-bug-list](../skills/zentao-bug-list/SKILL.md) lists and prioritizes Bugs
in that scope (read-only), and [zentao-fix-bug](../skills/zentao-fix-bug/SKILL.md)
fixes one scoped Bug.

## PostgreSQL

[psql-init](../skills/psql-init/SKILL.md) binds a project to local PostgreSQL
services, and [psql](../skills/psql/SKILL.md) queries or modifies data in those
bound services through the installed `psql` CLI.

## Apifox

- Workflow: [apifox-init](../skills/apifox-init/SKILL.md) and
  [apifox](../skills/apifox/SKILL.md).
- Configuration and commands: [connection contract](../skills/apifox-init/references/connection.md).

`apifox-init` selects projects and credential aliases and writes a workspace
resource for registered members, keeping `.apifox/projects.json` for
unregistered repositories. Several projects can share one credential, and
different aliases can hold separate tokens, even for the same account. Tokens
live in `local/apifox/credentials.json` and are entered through the helper's
hidden terminal prompt. The `apifox` skill supplies the project, server, and
token per command without switching global CLI accounts. These local skills
replaced the previous upstream Apifox submodule.

## Server Operations

- Workflow: [server-ops skill](../skills/server-ops/SKILL.md).
- Details: [authentication and continuation](../skills/server-ops/references/authentication.md),
  [inventory contract](../skills/server-ops/references/inventory.md), and the
  [example inventory](../skills/server-ops/assets/servers.example.yaml).

`server-ops` uses local OpenSSH directly and adds no remote agent, custom CLI,
or MCP dependency; connection routing and credentials stay in the user's SSH
setup. The optional inventory in `local/server-ops/servers.yaml` maps SSH
aliases to projects, environments, and services and must not contain passwords,
keys, or tokens. An explicitly selected existing SSH alias also works without an
inventory. Example requests:

```text
/server-ops Register SSH alias orders-test as the test environment of project orders, service orders-api.service
/server-ops Show orders-api error logs from the last 15 minutes in the orders test environment
/server-ops Restart orders-api on orders-test and verify that it recovered
```

Installing or evaluating the skill does not connect to any host; real-server
connectivity is a separate check against a target the user selects.
