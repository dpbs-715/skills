# File Organization

Split by stable responsibility, not mechanically by line count.

Very large feature files should be split by sub-feature, flow, or responsibility.

Place by ownership first, reuse second.

Placement:

- Feature-specific code stays in the feature directory.
- Domain-shared code stays in the domain/module directory.
- Only cross-domain, business-neutral code goes to common/shared.
- Do not promote to common just because two files use it once.

Layout:

- Group by role, not by file type; a flat folder mixing entry points, operations, helpers, and tests is a smell.
- Separate user-facing entry points, the operations they invoke, and the shared libs both depend on.
- Name directories for their role (entry, commands, lib), not their shape.
- Colocate tests with the code they cover.
- Keep the layout reorganizable: a unit must not depend on its own depth or path in the tree.

Import paths:

- Follow the language's import conventions and the conventions of the package being edited. Short relative references work well for neighboring modules that move together. Across packages, use the owning package's public entry points.
- When a reference traverses several parent directories or modules, prefer an established path that identifies the same target independently of the caller's location. Python can name the package directly, and Rust can start at `crate::` for a module in the same crate.
- In JavaScript or TypeScript, keep nearby imports such as `./OrderRow`. If the project already maps `@` to `src`, prefer `@/shared/formatDate` over `../../../shared/formatDate` when both resolve to the same file and the build, runtime, and tests support the alias. Keep the working relative path when there is no suitable alternative.

Module boundaries:

- Identify the owner of rules, state, use cases, and external effects before choosing folders. A domain module and a deployment/package boundary need not coincide.
- Cross-module consumers use the owner's public contract instead of reaching into implementation files. Keep the contract focused on caller-visible behavior, types, errors, and events.
- Keep dependency direction explicit: business rules do not depend on UI or platform implementations; use capability interfaces when a use case needs external effects.
- Adapt layer names and directory depth to the project. Do not create empty layers or split files merely to match an architecture template.

Good to extract:

- Stable, named configuration that helps the main entry stay focused: columns, fields, schemas, rules, metadata, field lists, option maps, status/display config, repeated defaults, or behavior settings.
- Config/constants reused within the same owner scope.
- Enums/status/type codes shared within a feature/domain.
- Independent sub-flows with their own request, loading, validation, submit, or error-handling lifecycle.
- Complex feature sub-flows or sub-components.
- Public types/contracts/schemas.
- Pure utilities with no feature-specific context.

Keep together:

- Small logic that changes together.
- Feature code where splitting hurts reading flow.
- One-off helpers only used by the current file.

Prefer:

- Names that describe responsibility, not file shape.
- Local first, shared only after real reuse appears.
