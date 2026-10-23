# Multi-project connections

## Ownership

- An explicit member `bindings.apifox` reference owns project bindings in the
  workspace map. Unmigrated members retain `<repository>/.apifox/projects.json`.
  Read [workspace integration bindings]({{REPO_ROOT}}/skills/project-init/references/integrations.md)
  for source selection, writes, and explicit migration. Token values never enter
  either binding store.
- `{{REPO_ROOT}}/local/apifox/credentials.json` owns this checkout's named tokens.
  This private directory is gitignored and separate from the native CLI's
  `~/.apifox/config.toml`. The path is anchored to the skills checkout, regardless
  of the current business repository or installed skill symlink.
- The helper supplies the selected `--project`, `--api-base-url`, and
  `--access-token` on each child process. It never logs in, switches accounts,
  or updates the CLI's global configuration.

A project's identity is `(server, id)`. Preserve a private server's URL path.
A credential is bound to one server; reject mismatches before any network call.
The same numeric project ID on another server is a different project.

## Repository manifest

```json
{
  "schemaVersion": 1,
  "defaultProject": "backend",
  "projects": [
    {
      "key": "backend",
      "id": 101,
      "name": "Backend API",
      "server": "https://api.apifox.com",
      "credential": "work"
    },
    {
      "key": "mobile",
      "id": 202,
      "name": "Mobile API",
      "server": "https://api.apifox.com",
      "credential": "client"
    }
  ]
}
```

These are illustrative IDs/names, not initialization defaults. Allowed fields
are exactly those shown. `defaultProject` is an existing key or `null`.
Projects are non-empty, keys are unique, IDs are positive safe integers, names
come from the server. Aliases start with a lowercase letter and use at most
64 lowercase letters, digits, underscores, or hyphens. Server URLs are absolute
HTTP(S), without user info, queries, or fragments; normalize trailing slashes.
Reject unexpected fields, invalid references, symlink manifests and symlink
`.apifox` directories before writing. Preserve unrelated CLI files.

Only an effective `source: none` means uninitialized; do not infer a binding from
native `settings.json`, the repository name, or the CLI's current account.
An existing native `settings.json` project ID can be offered as a candidate,
but validate it through a chosen alias before adding it.

## Local credentials

The private file has this shape (placeholder only):

```json
{
  "schemaVersion": 1,
  "credentials": {
    "work": { "server": "https://api.apifox.com", "token": "<local-only>" },
    "client": { "server": "https://api.apifox.com", "token": "<local-only>" }
  }
}
```

Use the helper in the user's terminal to create/rotate one alias while retaining
other aliases. The default store is created in the ignored `local/apifox/`
directory, with file mode `0600` and a new parent directory mode `0700` on POSIX.
A developer can give their own token the same alias used by
shared repository bindings. Changing an alias's server requires revalidating its
project bindings; the runner rejects old bindings to a different server.

```sh
node {{REPO_ROOT}}/skills/apifox-init/scripts/connection.mjs credential-set --credential work --server https://api.apifox.com
```

The command prompts without echo. For automation it also accepts token bytes
on stdin; do not embed real tokens in commands. It does not validate a token
remotely; `discover` or a bound `project get` does that. Concurrent credential
writers are rejected with a lock-file error; do not delete an active writer's
lock. Native CLI logins remain independent; do not copy secrets into chat to
import them. `--credentials <private-file>` explicitly selects an alternate
local store, primarily for isolated tests; never derive this path from repo data.

The former `~/.config/apifox-skills/credentials.json` location is no longer read
automatically. When explicitly migrating an existing store, validate it, copy
its complete contents without printing tokens, refuse to overwrite a different
destination, and verify aliases, bytes, and private permissions before removing
the old file. Ordinary credential reads never migrate files.

## Helper commands

Use the helper path from the calling skill. Options before `--` belong to the
helper; arguments after it belong to Apifox. Use argument arrays or proper shell
quoting, never evaluate project names as shell code.

```sh
node <helper> credentials
node <helper> inspect --root <repository>
node <helper> discover --credential work -- project list
node <helper> discover --credential work -- project get 101
node <helper> run --root <repository> --project backend -- project get 101
node <helper> run --root <repository> --project backend -- endpoint list
node <helper> run --root <repository> --project backend -- endpoint get <id> --branch <branch>
node <helper> run --root <repository> --project backend -- cli-schema get <schema-key>
```

`inspect` and `run` use the unified workspace resolver automatically. `inspect`
includes effective source metadata; `--workspace <name>` selects an ambiguous
workspace for either command. A workspace reference is authoritative even when
the old file conflicts or is malformed. No reference retains the legacy file;
invalid workspace maps or unknown selectors never fall back. Write workspace
bindings with `project binding-save apifox`, and import old manifests only when
requested with `project binding-import apifox`. Both preserve local tokens and
unrelated native CLI files. The binding schema above remains unchanged.

Selection order: explicit project **key**, saved default, sole bound project.
Otherwise ask the user. Unknown keys never fall back. Keep the selected key
throughout the task and display it before writes. To query several projects,
resolve and run each separately, retaining the key/server in the reported
results. Never fan a mutation out to all projects unless the user requested it.

Do not pass raw CLI token, server or project overrides after `--`; the helper
rejects them. `project get` uses its positional bound ID. Account/team operations
and global CLI maintenance are outside this runner's scope. `variables` supports
several scopes: use project scope only here; ask separately for team-level work.
For branches/environments/resources referenced in flags or payloads, verify
membership in the selected project before use. The wrapper supplies connection
context; it is not a complete authorization or payload validator.

The helper invokes the installed CLI without a shell and redacts stored tokens
from stdout/stderr and errors. The token is passed internally as a CLI argument,
so it is still visible to OS process inspection; this is not a secret transport
API. Do not print the child argv or enable diagnostics that record it. Returned
business data and exported files may contain other secrets: inspect only what
the task needs and redact credentials before showing excerpts.

A failed operation never triggers fallback to another alias, automatic retries
of writes, or global account switching. Inspect the sanitized error, help, and
current resource state before deciding the next step. The runner bounds each
command to ten minutes; a timeout does not prove a remote write was rolled back.
