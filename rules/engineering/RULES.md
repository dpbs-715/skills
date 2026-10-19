# Engineering Rules

## Start With Scope

Before defining requirements, adding capability, or choosing an implementation, identify the user's intended outcome, what can be omitted or reused, and the smallest useful change. Use confirmed goals, constraints, and acceptance criteria; keep this check brief and apply it to small fixes without adding a report or approval step.

Read and apply [Build What's Needed](topics/build-what-is-needed.md) for these decisions, including when the user says to start development. Reading this index alone does not apply the topic rules.

For a new product, MVP, or major feature with uncertain demand, value, or adoption, also read and apply [Before You Build](../../skills/before-you-build/SKILL.md). The lead agent can load it directly by this path; delegation to a product manager is optional. If the need and acceptance criteria are already established, proceed with the scope check. If only technical feasibility, field meaning, or interface availability is uncertain, inspect the existing code, data, and contracts first.

## Load Matching Topics

Load every matching topic file, and skip unrelated files to keep context small.

## Topics

- Abstraction, design patterns, ports, or platform adapters: read [topics/abstraction.md](topics/abstraction.md).
- Module design, cross-module changes, feature impact analysis, or architecture migration/checks: read [topics/architecture.md](topics/architecture.md).
- Data copying, enrichment, normalization, model conversion, field preservation, or boundary projection: read [topics/data-transformation.md](topics/data-transformation.md).
- Complex state/config modeling, state ownership, or asynchronous ordering and recovery: read [topics/state-modeling.md](topics/state-modeling.md).
- Naming, function signatures, comments, or code readability: read [topics/naming-and-comments.md](topics/naming-and-comments.md).
- Git branch naming or repository workflow preferences: read [topics/git-conventions.md](topics/git-conventions.md).
- File/directory organization, structuring, layout, or splitting work: read [topics/file-organization.md](topics/file-organization.md).
- Magic values: read [topics/magic-values.md](topics/magic-values.md).
- Requirements and scope decisions, deciding what to build or remove, process improvement, performance optimization, or automation: read [topics/build-what-is-needed.md](topics/build-what-is-needed.md).
- Consistency, coherence, single entry points, or matching existing patterns: read [topics/consistency.md](topics/consistency.md).
- Replacing mock/static data with real API fields: read [topics/api-integration.md](topics/api-integration.md).
