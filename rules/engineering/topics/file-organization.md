# File Organization

Split by stable responsibility, not mechanically by line count. Avoid over-splitting small cohesive logic into fragmented files merely for form.

Place by ownership first, reuse second.

## Growth And Split Checkpoints

Use size and mixed responsibilities as mandatory split-evaluation triggers, not mechanical line quotas:

- A production file approaches or exceeds ~500–600 lines.
- A single function, orchestrator, or dispatcher exceeds ~100–120 lines.
- A single UI container mixes state, side effects/subscriptions, and rendering for multiple independent user or business flows.

When a target crosses a checkpoint, do not append a new independent sub-flow, command, handler, branch, or unrelated section to the end before evaluating a split. First extract a clear responsibility boundary—or place the new capability in its own focused module and wire it from the existing entry—before adding behavior.

Very large feature files should be split by sub-feature, flow, or responsibility. Keeping a file above a checkpoint is acceptable only when it serves one genuinely cohesive concern, not as a shortcut for a smaller diff.

## Thin Entry Points And Module Roots

- Keep application entry points, module roots (such as `main.*`, `mod.*`, `index.*`), and top-level orchestrators thin: limit them to module declarations, dependency wiring, state/route registration, lifecycle setup, and the public contract.
- Move concrete command or route handlers, tool or action dispatch branches, platform-native or FFI adapters, and diagnostic or smoke-test routines into dedicated responsibility modules.
- When an orchestrator or dispatcher handles multiple distinct operations, delegate each branch to a focused handler module or function instead of growing a single multi-hundred-line switch or chain.
- Keep top-level UI containers focused on shell layout and composition; extract independent business flows—along with their local state, listeners, and rendering—into dedicated feature components or controllers.

## Domain-Partitioned Catalogs And Agent-Friendly Layout

- When a centralized catalog or registry (such as localized copy/i18n dictionaries, prompt collections, error tables, or static registries) spans multiple business domains, partition it into domain-scoped modules instead of appending miscellaneous or "additional/remaining" sections to a single file.
- Expose partitioned catalogs through clear top-level domain namespaces; if an individual domain grows large, split it internally into sub-files aggregated by that domain's entry module.
- Give exported symbols, namespaces, and catalog keys distinct, searchable names so full-text search locates definitions and call sites directly without scanning unrelated domains.

## Test And Harness Separation

- Short, focused unit tests may live inline with the production code they verify.
- When an inline test block grows large (roughly over ~150 lines) or consists of diagnostic harnesses, smoke-test flows, or heavy fixtures, move it into a dedicated sibling test or smoke-test file in the same directory so the production file remains focused.

## Placement

- Feature-specific code stays in the feature directory.
- Domain-shared code stays in the domain/module directory.
- Only cross-domain, business-neutral code goes to common/shared.
- Do not promote to common just because two files use it once.

## Layout

- Group by role, not by file type; a flat folder mixing entry points, operations, helpers, and tests is a smell.
- Separate user-facing entry points, the operations they invoke, and the shared libs both depend on.
- Name directories for their role (entry, commands, lib), not their shape.
- Colocate tests with the code they cover.
- Keep the layout reorganizable: a unit must not depend on its own depth or path in the tree.

## Import Paths

- Follow the language's import conventions and the conventions of the package being edited. Short relative references work well for neighboring modules that move together. Across packages, use the owning package's public entry points.
- When a reference traverses several parent directories or modules, prefer an established path that identifies the same target independently of the caller's location. Python can name the package directly, and Rust can start at `crate::` for a module in the same crate.
- In JavaScript or TypeScript, keep nearby imports such as `./OrderRow`. If the project already maps `@` to `src`, prefer `@/shared/formatDate` over `../../../shared/formatDate` when both resolve to the same file and the build, runtime, and tests support the alias. Keep the working relative path when there is no suitable alternative.

## Module Boundaries

- Identify the owner of rules, state, use cases, and external effects before choosing folders. A domain module and a deployment/package boundary need not coincide.
- Cross-module consumers use the owner's public contract instead of reaching into implementation files. Keep the contract focused on caller-visible behavior, types, errors, and events.
- Keep dependency direction explicit: business rules do not depend on UI or platform implementations; use capability interfaces when a use case needs external effects.
- Adapt layer names and directory depth to the project. Do not create empty layers or split files merely to match an architecture template.

## Good To Extract

- Stable, named configuration that helps the main entry stay focused: columns, fields, schemas, rules, metadata, field lists, option maps, status/display config, repeated defaults, or behavior settings.
- Config/constants reused within the same owner scope.
- Enums/status/type codes shared within a feature/domain.
- Independent sub-flows with their own request, loading, validation, submit, or error-handling lifecycle.
- Complex feature sub-flows or sub-components.
- Public types/contracts/schemas.
- Pure utilities with no feature-specific context.

## Keep Together

- Small logic that changes together.
- Feature code where splitting hurts reading flow.
- One-off helpers only used by the current file.

## Prefer

- Names that describe responsibility, not file shape.
- Local first, shared only after real reuse appears.
