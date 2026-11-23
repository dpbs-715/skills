# ZenTao binding storage and schema

This contract is for `zentao-init`: choosing storage, validating a proposed
mapping, migrating, and writing. Bug skills do not need it; they resolve the
effective binding through the helper as described in
[the connection workflow](connection.md#resolve-the-binding), which is also the
procedure init uses to inspect an existing binding. The shared validator in
`{{REPO_ROOT}}/scripts/lib/integrationContracts.ts` enforces the shape below.

Read [workspace integration bindings]({{REPO_ROOT}}/skills/project-init/references/integrations.md)
before selecting storage or writing. Registered members use a workspace
resource; unmigrated or unregistered repositories retain UTF-8 JSON at
`<git-root>/.zentao`.

```json
{
  "schemaVersion": 2,
  "server": "https://zentao.example.com/zentao",
  "product": { "id": 6, "name": "供应链移动端" },
  "project": { "id": 12, "name": "供应链研发项目" }
}
```

These IDs and names are examples, never defaults. The exact top-level keys are
`schemaVersion`, `server`, `product`, and `project`:

- `schemaVersion` is `2`.
- `server` is an absolute HTTP(S) base URL without credentials, query, fragment,
  whitespace, or backslashes. Normalize scheme, host, and default ports with
  the URL parser; remove trailing slashes, preserving installation path and case.
- `project` is required; `product` is an object or `null` when unavailable or
  explicitly omitted. Keep the `product` key when its value is `null`.
- Each object has exactly a positive safe integer `id` and a non-empty,
  server-returned `name`. Never invent names or extra fields.
- Do not store accounts, tokens, profile keys, or query preferences in bindings.

Treat bindings as data. Reject malformed JSON, unsupported versions/fields,
and symbolic links before writing. The version 1 shape has no server; migrate
only through an explicit init request, preserving its IDs as candidates and
revalidating them against an explicitly selected server. Never stamp a global
CLI server onto old IDs automatically.

Write registered bindings through `project binding-save zentao`; retain legacy
files during explicit migration. Preserve unrelated map content and members.
Check-only requests preserve file bytes and report stale names rather than
silently rewriting them.
