# Workspace Integration Bindings

Read this contract when initializing, migrating, or using ZenTao, PostgreSQL,
or Apifox bindings. The integration-specific skill still owns selection, remote
validation, and execution. This contract owns storage and source resolution.

## Resource Definitions and Member References

Keep shared definitions in `resources.<kind>.<resource-name>` and explicit member
references in `projects.<member>.bindings.<kind>`. A resource contains the full
existing integration manifest, including its schema version. This preserves
multi-service PG and multi-project Apifox selection/default behavior.

```yaml
name: scm
projects:
  web:
    path: /work/scm-web
    uses: [api]
    bindings:
      zentao: main
      apifox: main
  api:
    path: /work/scm-api
    bindings:
      zentao: main
      psql: backend
      apifox: main
resources:
  zentao:
    main:
      schemaVersion: 2
      server: https://zentao.example.com/zentao
      product: null
      project: {id: 12, name: Supply chain}
  psql:
    backend:
      schemaVersion: 1
      defaultService: dev-orders
      services:
        - {name: dev-orders, dbname: orders, environment: development}
  apifox:
    main:
      schemaVersion: 1
      defaultProject: backend
      projects:
        - key: backend
          id: 101
          name: Backend API
          server: https://api.apifox.com
          credential: work
```

Resource names start with a lowercase letter and use at most 64 lowercase
letters, digits, underscores, or hyphens. Merely defining a resource, or adding
`uses: [api]`, does not bind another member to it. Bind shared resources to each
intended member explicitly. Keep CLI logins, profile keys, PostgreSQL routing
and authentication, and Apifox token values in their existing machine-local
stores. Maps contain binding metadata and credential aliases only.

## Effective Source

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project binding zentao --cwd "<repository>"
node "{{REPO_ROOT}}/scripts/skills.ts" project binding psql --cwd "<repository>"
node "{{REPO_ROOT}}/scripts/skills.ts" project binding apifox --cwd "<repository>"
```

The result includes `source` (`workspace`, `repository`, or `none`), `file`, and
the validated `binding` when present. Workspace results also identify
`workspace`, `member`, and `resource`. Pin this source and any needed workspace
selector for the task; report it with the execution target.

1. A matching member's explicit workspace reference is authoritative. Ignore
   legacy repository files for that integration, even if they are invalid or
   conflicting. Do not silently fall back if the workspace binding fails.
2. Multiple matching workspaces providing bindings require `--workspace <name>`.
   An unknown or non-member selection is an error, not a fallback request.
3. Without a workspace reference, retain the existing repository-local binding:
   `.zentao`, `.psql`, or `.apifox/projects.json`. A registered but unmigrated
   member still follows this path. Do not infer ownership from CLI globals.
4. `source: none` means the integration is uninitialized. Preserve each skill's
   existing behavior: PG may offer local services; ZenTao/Apifox require init.
5. Malformed maps, missing references, or invalid legacy bindings fail before
   service calls. Do not reinterpret validation errors as absence. Nonexistent
   repositories and filesystem permission failures are also distinct errors.

## Initialize, Reuse, or Update

For an already registered member, the integration's init skill writes its
validated binding to the selected workspace. Reuse an existing suitable resource
or choose a new resource name; ask only for unresolved choices. Show all members
referencing an existing resource before changing it. Updating that definition
changes their effective binding too; the user's requested scope must include
those members, otherwise create a separate resource.

Prepare the complete integration manifest as temporary JSON, then run:

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project binding-save psql --cwd "<repository>" --workspace "<name>" --resource "<resource>" --input "<temporary-json>"
```

Replace `psql` with the intended kind. This updates only that resource and the
current member's reference, preserving other maps, resources, members,
relationships, and unchanged unavailable paths. Verify with `project binding`
and the integration's normal validation. When several maps match, select one
explicitly. For an unregistered repository, retain the old init destination;
do not implicitly create a workspace. Initializing a binding does not initialize
another integration or connect MCP servers.

## Explicit Migration

When the user requests migration, import an existing valid repository binding:

```bash
node "{{REPO_ROOT}}/scripts/skills.ts" project binding-import zentao --cwd "<repository>" --workspace "<name>" --resource "<resource>"
```

The command validates the legacy manifest, refuses to overwrite a different
resource or replace a different current reference, and keeps the legacy file
byte-for-byte unchanged. A subsequent effective-source read must report
`workspace`. Import each additional member explicitly if it should share the
resource. Version 1 ZenTao mappings need the existing server-selection migration
first; never stamp the CLI's current server onto them.

No ordinary query, startup discovery, or check-only request migrates or deletes
configuration. After verification, remove old files only if the user asks.
Concurrent or stale updates are rejected. Reload the map and re-apply the
requested change before retrying; never remove an active map writer's lock.
If project-init changes the map later, preserve all resources and references
unless the user requests their change; refuse removal that leaves dangling
references or service defaults.
