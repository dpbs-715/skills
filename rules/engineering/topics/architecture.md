# Architecture

Use these decisions for module design, changes that cross ownership boundaries, and architecture migrations. Scale the analysis to the change; a local edit does not need a full architecture process.

## Trace Behavior Before Changing Boundaries

- Start with the requested behavior and current source. Read the target's public contract, directly relevant dependency contracts, and existing specs/tests; expand into implementations as needed to resolve behavior, owners, or callers.
- Trace each affected user entry through draft/default values, validation, the command that accepts the change, its state owner, and persistence or recovery where relevant.
- Shared UI does not prove shared defaults, state ownership, validation, or commit effects. Verify each affected entry before unifying behavior.
- Explain dependencies by their effect on behavior and support them with current files or symbols. Imports and curated graphs are discovery evidence, not proof of product semantics.
- For ownership or public-contract changes, record the affected boundary, invariants, and representative acceptance cases in the project's existing design/spec format when available. Keep the record proportional to the change.
- Select validation cases from dimensions that can change behavior. Explain omitted high-risk combinations through an invariant or guard rather than enumerating every possible combination.

## Preserve And Check Boundaries

- Reuse the existing command or service path when it owns the behavior. Define the public contract and allowed dependency direction before introducing a new cross-module edge.
- Use existing architecture checks when available. Know whether they resolve package imports, aliases, dynamic imports, and the intended change range; a passing partial check does not establish whole-project compliance.
- Separate observed source behavior, declared architecture, and verified test results. Missing paths or planned tests are evidence gaps, not implemented guarantees.
- Migrate legacy modules within an explicit scope. Distinguish existing violations from new ones, and update an accepted baseline only for an intentional, explained change; never refresh it merely to silence failures.
- Keep enforceable policy in its authoritative configuration and reference it from guidance. Avoid duplicating thresholds and dependency lists across instructions.
