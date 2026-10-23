---
name: project-init
description: Initialize, inspect, or update associations between local repositories such as frontend, backend, and mobile projects. Use for /project-init, $project-init, or explicit requests to register, link, check, or change related projects. Maps stay private in this skills checkout; ordinary session discovery never initializes them.
compatibility: Requires Node.js 24+, Git, and this skills checkout with dependencies installed.
---

# project-init

Use skill instructions and examples in English. Respond in the user's language.
Read [the workspace contract](references/workspaces.md) before proceeding.

## Workflow

1. Discover associations from the session's actual working directory and list
   existing maps with the helper commands in the contract. Identify the current
   repository and reuse a matching map for updates. If several maps fit and the
   user's intent does not select one, ask which map to maintain.
2. Gather the workspace name, member repositories, short descriptions, and known
   `uses` relationships. Reuse paths and choices already supplied by the user.
   Ask for missing repository paths; offer existing registered members when
   useful. Do not scan the whole home directory, guess project membership from
   names, clone repositories, or move projects into a shared parent folder.
3. Inspect supplied member paths with `project inspect`. Show canonical roots
   and discovered instruction, skill, agent, MCP, and Serena configuration paths.
   Validate dependency keys against selected members. The name and project keys
   use lowercase letters, digits, hyphens, or underscores and start with a letter
   or digit. Use the current repository as a member unless the user explicitly
   asks to maintain another workspace.
4. For existing maps, preserve descriptions, members, relationships, resources,
   and member bindings unless
   the user requests their change. Missing local repositories are not removal
   authorization. A check-only request reports the saved map, path availability,
   and live entry-point inventory without writing. For malformed maps, explain
   the exact problem; do not overwrite them as an incidental repair.
5. When the requested associations are clear, prepare the complete map in a
   temporary YAML or JSON file and call `project save --input <file>`. Use
   `--replace` only to update the selected existing map. User selections authorize
   the map change; do not ask an extra generic confirmation. The helper validates
   and normalizes paths, prevents duplicate repository identities, and refuses
   accidental overwrites. Re-read through `project list` and discover from a
   member repository to verify the saved result.
6. Report the absolute map path, members, relationship changes, and unavailable
   paths. Distinguish configuration discovery from tools connected to the current
   session. Maps are live-read, so they do not require re-linking after edits.

Global discovery entry points are installed once by `pnpm skills link`; normal
sessions do not invoke this initialization skill. If those entry points have
not been installed, explain that one-time setup using the contract. Do not edit
member repositories or host/MCP configuration as part of map initialization.

## Examples

```text
/project-init Associate this frontend with /work/scm-api and /mobile/scm
/project-init Add /work/scm-mobile to the existing scm workspace; it uses api
/project-init Check this project's associations and available agent entry points
/project-init The api repository moved to /work/services/scm-api; update its path
```
