# Repository-bound ZenTao connections

Read this workflow before any ZenTao query in init, bug-list, or fix-bug. Use
the connection script path supplied by the calling SKILL.md. Do not run bare
`zentao product`, `zentao project`, or `zentao bug` commands: CLI 0.2.0 otherwise
uses its global current profile, which may belong to another repository.

## Server identity

Version 2 `.zentao` contains exactly `schemaVersion`, `server`, `product`, and
`project`. The latter two fields retain the version 1 object contract. Version
1 has no server binding and must be migrated with init before any Bug query.

Parse `server` as an absolute HTTP(S) URL. Reject credentials in the URL, query
strings, fragments, whitespace, and invalid URLs. Normalize scheme and host
case and default ports with the standard URL parser, and remove trailing
slashes. Preserve the installation path and its case. Never match solely by
hostname: `https://example.com/team-a` and `https://example.com/team-b` are
different services, as are HTTP and HTTPS or different non-default ports.

Compare saved profile servers using the same normalization. Store the
normalized base URL in new or migrated mappings. Never treat a numeric object
ID or object name as proof that two services are the same.

## Discover saved logins

Check that Node.js and `zentao` are installed, then run:

```sh
node <connection-script> profiles
```

The helper copies the active CLI config into a private temporary directory,
asks `zentao --config <temporary-file> profile --format=json` for metadata, and
removes the copy afterward. It exposes the CLI's `currentProfile` and entries
with `key`, `server`, `account`, and `current`; it does not print credentials.
Saved metadata is evidence of a configured login, not proof its token is still
valid. The first remote read verifies access.

The helper respects `ZENTAO_CONFIG_FILE`, otherwise uses
`~/.config/zentao/zentao.json`. When the user explicitly uses a custom CLI
configuration, pass `--config '<absolute-path>'` to the helper for discovery
and every subsequent call. Keep this local path out of `.zentao`. Do not read
or display the config contents or enumerate environment variables yourself.

## Select the server and account

Init selects a server before listing its products/projects. Bug skills require
the stored server. Once the server is known, filter saved profiles to that
exact normalized server and choose one:

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
the profile key at `@`. Retain the exact `key` and server for the entire
invocation, including pagination, retries, and additional detail reads.
Re-discovery must not silently select a different account mid-query.

## Run a bound read

```sh
node <connection-script> run --server '<server>' --profile '<exact-key>' -- bug 42
node <connection-script> run --server '<server>' --profile '<exact-key>' -- product --all --pick=id,name
```

Replace placeholders with verified values and quote shell arguments safely, or
use a process argument array. The helper emits JSON. Each invocation:

- creates its own temporary directory with mode `0700` and an opaque config
  copy with mode `0600`, outside the repository;
- checks the exact profile key and normalized server against CLI metadata;
- selects that key inside the copy and verifies the selected key/server again;
- runs only a supported read command with the same temporary `--config`;
- removes authentication environment overrides from child processes so the CLI
  cannot fall back to a different environment login;
- removes the temporary directory on completion or handled failure.

This permits A and B to query concurrently without switching the shared global
profile. The CLI still owns credentials; neither credentials nor profile keys
are stored in the repository mapping. The helper never writes changes back to
the source CLI config. It also avoids the normal configstore write beside the
global file during read commands.

Run every page through this helper with the same selected key and server. Its
allowlist covers the reads these skills need; do not bypass rejection by using
bare CLI commands or enabling raw request/configuration overrides. For uncertain
read options, run `bug --help` through the helper with the same server and key;
it returns a JSON object containing the help text. If the required option is
not supported by the helper, report the limitation instead of changing its code
inside an application repository.

## Failures

- Missing CLI or Node.js: report the prerequisite; do not install automatically.
- Missing CLI config, no matching profile, or CLI `1006`: identify the intended
  server (if known) and direct the user to terminal login. Do not collect secrets.
- Selected profile removed, ambiguous, or from another server: stop before the
  API call. Do not retry with the global current profile.
- Authentication rejection or expiry: ask for terminal re-login to the selected
  service. Permission denial is not proof the token expired; preserve the error.
- CLI `1005`: report a config read/write failure, not a login failure. The
  temporary-copy workflow normally avoids sandbox writes beside the global
  config. If access is still sandbox-blocked, request the environment's approval
  for the same helper command only; do not broaden it or expose config contents.
- Unsupported `--config` or failed post-switch verification: stop. Do not switch
  the global profile as a fallback.
- Other failures: preserve the reported code and useful message. For paginated
  reads, identify the failed page and do not present partial data as complete.

Show the selected server and account with the result so the query destination
is reviewable.
