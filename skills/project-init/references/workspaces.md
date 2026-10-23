# Workspace Contract

## Storage and Ownership

The sole map store is `local/project-workspaces/` inside this skills checkout.
It is Git-ignored and shared by the installed agent entry points. Do not create
copies in member repositories or `~/.config`. Copy maps separately or initialize
them again when moving to another computer. A skills-checkout move requires
`pnpm skills link` again to update the installed absolute references.

Each `<name>.yaml` describes a logical workspace. A project may belong to more
than one map. Relationships are local to each map; `uses` is directional and does
not grant write access. Multiple checkouts of the same Git worktree family are
one project identity. Separate clones are distinct; no matching by remote URL or
similar folder names occurs. Non-Git directories can also be registered.

```yaml
name: scm
description: Supply chain system
projects:
  web:
    path: /absolute/path/to/scm-web
    description: Management frontend
    uses: [api]
  api:
    path: /another/path/to/scm-api
    description: Backend services
  mobile:
    path: /mobile/path/to/scm-mobile
    description: Mobile client
    uses: [api]
```

Read [integration bindings](integrations.md) when resources or member bindings
exist. `project-init` preserves them; integration-specific init skills own their
configuration and explicit migration.

Required fields are `name`, a nonempty `projects` mapping, and each member's
`path`. Descriptions, `uses`, `resources`, and member `bindings` are optional. Paths are absolute or start with
`~/`; saving canonicalizes existing paths to repository roots. Dependencies must
name another member. Store only validated binding metadata under `resources`.
Do not store copied instructions, tool connection states, credentials, or MCP
server definitions in maps. Unknown fields are rejected so
updates cannot silently discard unsupported data.

## Commands

All commands emit JSON. They work from any current directory and anchor storage
to this checkout, not the calling repository. Quote paths as shell arguments.

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project list
node "{{REPO_ROOT}}/scripts/skills.ts" project discover --cwd "<current-directory>"
node "{{REPO_ROOT}}/scripts/skills.ts" project inspect --cwd "<member-directory>"
node "{{REPO_ROOT}}/scripts/skills.ts" project save --input "<temporary-map-file>"
node "{{REPO_ROOT}}/scripts/skills.ts" project save --input "<temporary-map-file>" --replace
```

- `list` returns saved maps and individual parsing errors without creating any
  directories. Read the selected map before preparing a replacement.
- `discover` returns all maps matching the current repository, member
  availability, and parsing errors. An absent store or no match is a normal empty
  result. Git worktrees match their original map while retaining the session's
  active checkout in the returned `path`.
- `inspect` lists existing root entry files and resource directories without
  reading credentials, contacting MCP servers, or running project hooks. This
  inventory does not replace checking nested instructions before file access.
- `save` accepts the complete YAML map or equivalent JSON and writes
  `<name>.yaml`. Creating an existing map fails; updates require `--replace` and
  a valid existing map of the same name. Existing unavailable members may remain
  unchanged during updates; new or moved members must exist locally. A malformed
  map requires explicit repair rather than replacement through this helper.

Saving replaces the selected map as a whole. Preserve members and their fields
when preparing an update unless the user explicitly requests removal. A helper
failure is not permission to bypass validation with a raw overwrite.

## One-Time Installation

Run `pnpm skills link` in this checkout once after installing the feature.
It installs `project-init`, links the discovery rule into Claude's rules
directory, and adds a managed discovery section to Codex and Pi global
instructions, preserving existing content. Only installed host directories are
targeted. `pnpm skills unlink` removes the managed sections and repository-owned
links while retaining user instructions and maps.

These are instruction-based entry points: they tell the agent to run discovery
before substantive work; they are not program-enforced startup hooks. Host
permissions and any disabled global-instruction loading still apply. No wrapper
command, per-session parameters, or per-member bootstrap files are required.
