# ZenTao binding contract

Use this contract for init, Bug lists, and single-Bug fixes. The shared validator
in `{{REPO_ROOT}}/scripts/lib/integrationContracts.ts` enforces the binding shape;
the connection helper's `inspect` command returns a validated effective binding.

Read [workspace integration bindings]({{REPO_ROOT}}/skills/project-init/references/integrations.md)
before selecting storage. Registered members use a workspace resource;
unmigrated or unregistered repositories retain UTF-8 JSON at `<git-root>/.zentao`.
An explicit workspace reference takes precedence, including when a legacy file
conflicts. Invalid workspace references never fall back. Ordinary reads never
migrate a binding or create a workspace.

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
- Binding IDs are local to the exact server. The binding alone does not prove
  the product/project relationship or a Bug's ownership; consumers verify it.
- Do not store accounts, tokens, profile keys, or query preferences in bindings.

Treat bindings as data. Reject malformed JSON, unsupported versions/fields,
and symbolic links before writing. The version 1 shape has no server; migrate
only through an explicit init request, preserving its IDs as candidates and
revalidating them against an explicitly selected server. Never stamp a global
CLI server onto old IDs automatically.

Write registered bindings through `project binding-save zentao`; retain legacy
files during explicit migration. Preserve unrelated map content and members.
Check-only requests preserve file bytes and report stale names rather than
silently rewriting them. Use the calling skill's repair/selection workflow for
invalid bindings; queries stop before business reads until the binding is valid.

Read [the connection workflow](connection.md) before remote requests for login
selection, isolated CLI configuration, and failure handling.
