---
name: apifox-init
description: Initialize, inspect, or update repository bindings to multiple Apifox projects and local credential aliases. Use for /apifox-init, adding or selecting Apifox projects, configuring multiple tokens, or checking project bindings. Does not modify remote API or test resources.
---

# Apifox Init

Requires Node.js and Apifox CLI; command shapes verified against CLI 2.2.11. Git discovers the repository root.

Maintain `.apifox/projects.json` in the user's code repository. One repository
can bind several projects, servers, and credential aliases. One credential can
serve several projects; several aliases can hold different tokens for the same
account. Use English instructions and respond in the user's language.

Read [the connection contract](references/connection.md) before initialization
or validation. Its helper is
`{{REPO_ROOT}}/skills/apifox-init/scripts/connection.mjs`.

## Workflow

1. Resolve the root with `git rev-parse --show-toplevel`. Outside Git, ask for
   the intended directory. Inspect `.apifox/projects.json` and the existing
   `.apifox` directory; preserve native CLI files such as `settings.json`.
   Use helper `inspect --root <root>` for an existing manifest. Invalid JSON,
   unsupported fields/versions, or symlinks require explaining the problem
   before a requested repair, not silently replacing the file.
2. Run `apifox --version` and inspect relevant `--help` locally. If missing,
   explain the prerequisite and let the user install it; initialization does
   not itself authorize global installation or upgrades.
3. Run helper `credentials`. Show alias and full server URL only. Never read
   or print the raw credential file in a tool response. If a needed alias is
   absent, provide the terminal `credential-set` command from the connection
   contract. The user enters the token in that terminal's hidden prompt.
   Do not request tokens in chat or put them in shell arguments/history.
4. Select an alias before querying projects. Honor explicit selections;
   otherwise offer structured choices, with a numbered menu fallback. A single
   alias may be proposed; the global CLI account is not repository ownership.
   For each selected alias, run helper `discover --credential <alias> -- project list`.
   Follow actual pagination if returned. Present `#<id> <name> — <alias> — <server>`
   choices and allow multiple selections. Do not require typing project names.
5. For explicit project IDs and selected candidates, use `project get <id>`
   through the same discovery alias and verify the returned identity. Only
   store server-returned names. Authentication, network, and empty-list results
   are distinct; do not substitute another token or server after failure.
6. Assign readable unique project keys (for example `backend`, `mobile`,
   `backend-readonly`) and show them with project IDs, servers, and aliases.
   A repeated server/project ID is allowed under another key when it uses a
   different credential. Preserve existing entries unless removal was requested.
7. For one project, propose it as the default. For multiple projects, offer
   their keys and `No default`; on updates retain the current default if kept.
   Multiple projects without a default require a selection for every task.
8. Show the exact manifest and destination. The user's explicit project,
   credential, and default selections authorize that binding; do not request
   redundant approval. Ask a choice question for inferred selections or an
   unresolved replacement. Never treat silence as a selection. Write with the
   workspace file tools and read it back through `inspect`.

For check-only requests, preserve file bytes and report each project's local
credential availability. If remote validation was requested, read each bound
project with its own credential and server. Names that changed remotely should
be reported, not silently rewritten during a check.

## Result

Report the manifest's absolute path, selected project keys/IDs/names, server and
credential aliases, and default (or no default). Distinguish local validation
from successful remote reads. If credentials are missing, say what remains
unverified and show the local terminal command to configure them.

Initialization authorizes configuration discovery and project binding only.
API changes, imports, test runs, branch creation and merging belong to `apifox`.
