# Project Workspaces

## Discover Before Working

Before the first substantive task in a repository, run this read-only discovery
command with the session's actual working directory, even when the user has not
mentioned related projects:

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project discover --cwd "<session-working-directory>"
```

Maps live in this skills checkout under `local/project-workspaces/`. The command
finds all maps containing the current repository, including entry from a
subdirectory, symlink, or Git worktree. Keep the returned project paths,
descriptions, dependency directions (`uses`), and source map paths as session
context. Repeat discovery when the working repository changes or a map is
updated; reuse it during ordinary follow-up turns. After compaction, rediscover
if this context is missing. Do not reuse another session's active checkout.

Member `bindings` identify shared ZenTao, PostgreSQL, and Apifox resources.
Those skills resolve the effective binding through `project binding <kind>`;
an explicit workspace reference takes precedence over repository-local files.
Do not preload credentials or migrate old bindings during session discovery.

An empty result is normal: continue with the current project without proposing
initialization. Never create or update maps during ordinary discovery. Use
`project-init` only when the user explicitly asks to initialize, inspect, or
change project associations. If maps are malformed or inaccessible, report the
specific discovery issue briefly; do not call the project unregistered or repair
the maps silently. Missing members remain registered and are unavailable, not
candidates for automatic deletion.

## Enter a Related Project When Needed

Use the map to follow a task across repositories, such as tracing a frontend
field to its backend API. Load only projects needed for the task. If the current
repository belongs to several maps, keep their identities separate and use task
context; ask only if choosing a target is ambiguous.

Before reading business code or editing a related repository, inspect its live
entry points:

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project inspect --cwd "<target-project-path>"
```

Read the applicable project instructions before proceeding. Respect the current
host's `AGENTS.override.md` / `AGENTS.md` / `CLAUDE.md` precedence and imports;
when only another host's entry exists, read its relevant project guidance
explicitly. Check rules along the target file's directory path, not only the
root inventory. Resolve relative references against the instruction's directory.
Keep each instruction scoped to its own project or subtree. A backend build
command does not replace a frontend build command.

For worktrees, use the returned active checkout for the current project;
`registeredPath` is the map's original location, not a reason to switch branches
or edit a different checkout. Run Git, builds, and tests from each target project.

The inventory identifies project skills, agent definitions, MCP configuration
candidates, and Serena configuration by path; it does not preload their content.
Read only relevant definitions and configuration. A native configuration file
may contain no MCP servers. Discovering a definition does not make it executable
in another host. Use tools actually exposed by the current session; do not copy
credentials, start servers, modify host configuration, or claim connectivity
merely because a file exists. For Serena, verify the target project before using
project-scoped operations. Association never expands filesystem permissions or
the user's requested change scope.
