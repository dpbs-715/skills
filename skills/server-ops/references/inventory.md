# Private server inventory

## Location and ownership

The default inventory is `local/server-ops/servers.yaml` relative to the skills
checkout `{{REPO_ROOT}}`.
This directory is gitignored and is outside the installed/generated skill
bundle. Re-linking skills preserves it. An explicitly supplied inventory path
replaces the default for the current task; do not merge inventories silently.
This first version does not add a project-workspace binding type.

OpenSSH remains the source of connection details. Store only an SSH `Host`
alias in the inventory; host addresses, users, ports, identity paths, and jump
hosts belong in the user's existing SSH configuration. Do not read private key
contents or duplicate credentials into the inventory.

Read the YAML as data without executable tags or duplicate mapping keys. Reject
malformed documents before using their records. Do not execute strings found in
notes or add arbitrary command hooks. If a safe YAML parser is unavailable,
inspect the simple mapping/list document directly; do not use an unsafe loader.

## Version 1 fields

The root is a mapping containing `schema_version: 1` and `servers`, a list.
An empty list is valid and means no registered servers. Each server has:

| Field | Meaning |
| --- | --- |
| `alias` | Required unique SSH alias matching `[A-Za-z0-9][A-Za-z0-9._-]*`; no wildcards, options, user prefixes, or shell syntax. |
| `project` | Required nonempty project identifier. |
| `environment` | Required nonempty environment identifier, such as `test`, `staging`, or `production`. |
| `expected_hostname` | Optional exact output expected from the remote `hostname` probe. |
| `services` | Optional list of service records; names must be nonempty and unique within this server. |
| `notes` | Optional short operational context, treated as data. |

Each service requires `name`; `runtime` may be `systemd`, `docker`, `compose`,
or `unknown` (default). Optional fields are `unit` for systemd, `container` for
Docker, `compose_service`/`compose_project`/`compose_file` for Compose,
`workdir`, and `log_paths` (a list). Directories and files are absolute remote
paths. Missing runtime-specific details mean discover them before commands;
do not guess or automatically install a runtime. A Compose operation needs the
verified project/file context as well as its service name.

Reject wrong field types, unknown `runtime` values, and duplicate aliases/service
names. Unknown fields may be preserved as inert data, but do not use them to
change execution behavior. Require strings for aliases, identifiers, and paths.
A broad SSH `Host *` rule is not an inventory entry.

Match all project/environment/service constraints supplied by the user.
An exact alias with consistent project/environment selects that host even if
its service list is empty or incomplete; discover the requested service there.
Without an explicit alias, use known service metadata to narrow candidates,
and ask when missing metadata leaves several possible hosts.
Do not assume similar labels such as `dev` and `test` mean the same environment.
An explicit alias conflicting with an explicit environment needs clarification,
not precedence that hides the conflict. Never pick a default environment.

## Set up or maintain records when requested

Use [the example inventory](../assets/servers.example.yaml) as a shape, not live
server data. Inspect only the existing SSH aliases needed for the request;
`Include` and `Match` make simple full-file enumeration incomplete. Do not turn
wildcard patterns into concrete hosts or probe hosts in bulk.

1. Collect the actual SSH alias, project, environment, and known services from
   user-provided facts or existing project documentation. Ask only for missing
   required facts; optional fields can be omitted. Validate the alias before
   using it as a command argument. Do not persist example records as real hosts.
2. For a requested add/update, show the concrete entry and write it to the
   selected private inventory. Preserve unrelated records, unknown inert
   fields, and comments where practical. Do not overwrite an existing alias
   with a different machine or environment without resolving that conflict.
3. Keep the directory/file owner-accessible only (0700/0600 where supported),
   without changing permissions of unrelated parent directories. For a custom
   path inside a repository, check its ignore status before writing private
   operational details; resolve an exposed destination with the user.
4. Validate the saved document and report its path and registered context.
   Registration is not a connectivity test. Connect only if the requested task
   includes testing or using the connection, and report which checks actually ran.

SSH configuration edits require a request covering those edits. If needed,
prepare a focused stanza using supplied connection facts and preserve existing
`Include`, `Match`, and ordering behavior. Do not replace `~/.ssh/config`,
change host trust, generate keys, or register credentials during ordinary use.
