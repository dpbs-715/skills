# Repository-bound ZenTao connections

Read this workflow before any ZenTao query in init, bug-list, or fix-bug. The
helper is `{{REPO_ROOT}}/skills/zentao-init/scripts/connection.mjs`, written
`<connection-script>` below. Never run bare `zentao` commands: without the
helper the CLI uses its global current profile, which may belong to another
repository or server. Never switch the global profile, read or display the CLI
config, enumerate environment variables, or collect credentials in chat.

## Resolve the binding

This is the authoritative binding-resolution procedure for all ZenTao skills.

1. Run `git rev-parse --show-toplevel` and use the result as `<repository>`.
2. Run `node <connection-script> inspect --root '<repository>'`. It applies the
   workspace/legacy precedence and the binding validation without reading
   credentials or contacting ZenTao. Do not resolve maps or `.zentao` yourself
   or rebuild a looser schema from Bug responses.
3. On success with a `binding`, pin it (`server`, `project`, and `product` or
   `null`) and its source metadata (`source`, `file`, and for workspace sources
   `workspace`, `member`, `resource`) for the whole task.
4. If the helper reports multiple workspace bindings, ask which workspace to
   use, then pass the same `--workspace '<name>'` to `inspect` and every bound
   `run --root`.
5. Treat `source: "none"` and every other error (invalid map or reference,
   unknown workspace, malformed or schema version 1 `.zentao`, symbolic link)
   as a binding failure. Stop before any ZenTao request and report the helper's
   message. Bug skills direct the user to `/zentao-init`; init follows its own
   inspect/repair workflow. Never fall back to another source or the global
   profile's server.

Ordinary reads never migrate, repair, or create a binding. Binding IDs are only
meaningful on the bound server, and the binding alone does not prove a
product/project relationship or a Bug's ownership. A Bug ID, matching object
name, or repeated numeric ID is not a server override; a request conflicting
with the binding needs clarification or `/zentao-init`.

## Discover saved logins

Check that Node.js and `zentao` are installed, then run:

```sh
node <connection-script> profiles
```

The helper reads a private temporary copy of the CLI config and returns
`currentProfile` plus entries with `key`, `server`, `account`, and `current`;
it never prints credentials. Saved metadata is evidence of a configured login,
not proof its token is still valid. The first remote read verifies access.

The helper respects `ZENTAO_CONFIG_FILE`, otherwise uses
`~/.config/zentao/zentao.json`. When the user explicitly uses a custom CLI
configuration, pass `--config '<absolute-path>'` to `profiles` and every `run`.
Keep this local path out of bindings.

## Select the server and account

Compare servers as normalized URLs: lowercase scheme and host, drop default
ports and trailing slashes, and keep the installation path and its case. Never
match solely by hostname: `https://example.com/team-a` and
`https://example.com/team-b` are different services, as are HTTP and HTTPS or
different non-default ports.

Init selects a server before listing its products/projects; Bug skills use the
bound server. Filter saved profiles to that exact server and choose one:

1. Honor an explicitly requested login account or exact profile key only if it
   uniquely matches that server. An assignee filter is not a login selection.
2. Otherwise use the current profile if it belongs to that server.
3. Otherwise use the sole matching profile automatically.
4. If several matching accounts remain, ask the user to select one, labeling
   choices with account and full server URL. Do not guess from repository names.
5. If none match, stop before any business API call. Show the required server
   and ask the user to run `zentao login` in their own terminal for that service,
   then retry discovery. Never substitute another service's login.

Use the metadata's `account` field for the default Bug assignee; do not split
the profile key at `@`. Retain the exact `key` for the entire invocation,
including pagination, retries, and additional detail reads. Re-discovery must
not silently select a different account mid-query.

## Run a bound read

```sh
node <connection-script> run --root '<repository>' --profile '<exact-key>' -- bug 42
node <connection-script> run --root '<repository>' --profile '<exact-key>' -- my bugs --help
```

Replace placeholders with verified values and quote shell arguments safely, or
use a process argument array. The helper emits JSON. `run --root` re-resolves
the binding, uses its server, rejects a conflicting `--server`, and checks the
profile against that server inside a private temporary config, so concurrent
reads never touch the global profile. Initialization may use
`run --server '<candidate>' --profile ...` without `--root` to validate an
explicitly selected candidate before saving; Bug workflows use bound reads.

The helper accepts `product`, `project`, `bug`, and `my bugs` reads and help.
It rejects write actions and config, auth, or raw request overrides. The
argument-free `version` command returns `{ cli, serverVersion, server }`, where
server information may be cached in the login profile and is not a live upgrade
check. Use `--help` through the helper for uncertain read options. Do not bypass
a rejection with bare CLI commands; report the limitation instead of changing
the helper inside an application repository.

## Failures

- Missing CLI or Node.js: report the prerequisite; do not install automatically.
- Missing CLI config, no matching profile, or CLI `1006`: identify the intended
  server (if known) and direct the user to terminal login. Do not collect secrets.
- Selected profile removed, ambiguous, or from another server: stop before the
  API call. Do not retry with the global current profile.
- Authentication rejection or expiry: ask for terminal re-login to the selected
  service. Permission denial is not proof the token expired; preserve the error.
- CLI `1005`: report a config read/write failure, not a login failure. If
  access is sandbox-blocked, request the environment's approval for the same
  helper command only; do not broaden it or expose config contents.
- Unsupported `--config` or failed profile verification: stop. Do not switch
  the global profile as a fallback.
- Other failures: preserve the reported code and useful message. For paginated
  reads, identify the failed page and do not present partial data as complete.

Show the selected server and account with the result so the query destination
is reviewable.
