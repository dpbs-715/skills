# Project Workspaces

Before the first substantive task in a repository, read and follow
`{{REPO_ROOT}}/generated/project-workspaces/SKILL.md`, then run this read-only
discovery command with the session's actual working directory:

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project discover --cwd "<session-working-directory>"
```

Run discovery even when related projects were not mentioned. Reuse its results
within the session; repeat when the working repository or a map changes, or
when discovery context is missing after compaction. An empty result is normal.
Ordinary discovery never creates maps, migrates bindings, or loads credentials.

Before reading business code or editing a related repository, run
`project inspect --cwd "<target-project-path>"` and load its applicable
instructions as the full skill requires. Keep each project's instructions scoped
to that project and use the active checkout returned by discovery.
