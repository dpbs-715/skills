# File Organization

Split by stable responsibility, not mechanically by line count.

Very large feature files should be split by sub-feature, flow, or responsibility.

Place by ownership first, reuse second.

Placement:

- Feature-specific code stays in the feature directory.
- Domain-shared code stays in the domain/module directory.
- Only cross-domain, business-neutral code goes to common/shared.
- Do not promote to common just because two files use it once.

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
