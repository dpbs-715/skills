---
name: psql-init
description: Initialize, inspect, or update a project's .psql by discovering locally configured PostgreSQL services and letting the user select which belong to the project. Use for /psql-init, $psql-init, requests to bind project database connections, or check missing local services. Does not query business data or modify local credentials.
compatibility: Requires local PostgreSQL connection service configuration; psql is needed only for requested connection verification.
---

# psql-init

Use skill instructions and examples in English. Respond in the user's language.
Read [the shared project contract](references/project.md) before proceeding.

## Workflow

1. Resolve the project root and inspect any `.psql` using the shared contract.
   Preserve the current manifest while preparing changes. For malformed files
   or unsupported versions, explain the issue and prepare a replacement only
   when the user requests repair; do not silently discard entries.
2. Discover the user's existing local services. Show a numbered table containing
   only service name and `dbname`, plus project membership or mismatch status
   when a manifest already exists. Do not expose host, port, account, or secrets.
   Discover all effective local sections, not just services sharing a guessed
   project prefix. Listing configuration does not require database connections.
3. Let the user choose which services to add to this project. Support multiple
   selections, including all listed services. Prefer a native multiple-selection
   UI when available; otherwise accept several numbered choices in one reply.
   Do not require retyping service names or invent project ownership from names.
   Honor exact selections already supplied by the user without asking again.
4. For a new manifest, one selected service becomes the default. With multiple
   selected services, offer their names and “No default” as choices. On updates,
   preserve an existing default if retained; if removed, ask for a new default
   or no default. Preserve existing project services unless the user explicitly
   deselects/removes them; absence from this machine is not removal authorization.
5. After the user's selections, write the manifest using the shared
   contract, then read it back and validate it. The selections authorize this
   project-only change; no additional generic confirmation is needed. Report
   added/removed services, default, and the absolute manifest path.

Service entries initially contain `name` and `dbname`. Add other project
metadata only for an actual user need, and preserve existing metadata on
updates. Follow the shared contract's prohibition on storing host, port,
account, or credentials; extensibility does not permit copying local connection
details into the project.

## Existing projects and missing connections

Compare every manifest entry with the effective local service of the same name:

| Condition | Status |
| --- | --- |
| Name and dbname match | Configured locally; connectivity untested |
| Service absent | Missing local service |
| Same name, different dbname | Database mismatch |
| Local service has no explicit usable dbname | Database unspecified |

For a check-only request, report differences without rewriting the manifest.
For missing services, list the expected name and dbname so the user can configure
them locally. Do not relabel authentication or network failures as missing
configuration. A same-name mismatch needs the user to decide whether to repair
the local service or intentionally update the project; do not overwrite either
automatically. Extra local services are simply available candidates.

If no services exist locally, explain which configuration locations were checked
and ask the user to configure services locally before retrying. Do not invent
host, port, database, credentials, or a project connection list. Services with
missing dbname cannot be added until that field is configured explicitly.

Initialization selects configuration; do not test every connection by default.
If the user requests verification, use psql with `-X -w -v ON_ERROR_STOP=1`, a
bounded connection timeout, and `SELECT current_database();` for selected
services only. Compare to the manifest and report results without exposing
connection details. Do not query business tables or perform writes.

## Examples

```text
/psql-init
/psql-init Add local services to this project
/psql-init Check which project services are missing locally
/psql-init Set <service-name> as the default
/psql-init Verify this project's connections
```
