# Multi-project connections

## Ownership

- `<repository>/.apifox/projects.json` owns project bindings, never token values.
- `~/.config/apifox-skills/credentials.json` owns this machine's named tokens.
  This is separate from the native CLI's `~/.apifox/config.toml`.
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

No `.apifox/projects.json` means uninitialized; do not infer a binding from
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
other aliases. The default store is created outside the repository, with file
mode `0600` and a new parent directory mode `0700` on POSIX. No `.gitignore`
change is needed. A developer can give their own token the same alias used by
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
