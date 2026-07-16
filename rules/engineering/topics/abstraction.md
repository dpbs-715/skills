# Abstraction

Prefer intentional abstraction over long literal procedures.

Prefer modeling stable concepts as classes/objects/configs over writing long procedural code.

Use abstraction/patterns when:

- They remove branching, repetition, or scattered rules.
- The domain has stable roles, strategies, states, or workflows.
- The resulting code is easier to read at the call site.

Avoid when:

- The pattern is only decorative.
- The abstraction hides simple logic behind more indirection.
- The domain boundary is still unclear.

Prefer:

- Domain concepts over generic helpers.
- Small composable units over long imperative flows.
- Clear names that explain the design.
- Shared context (roots, base paths, config) resolved from one fixed anchor over values derived from each caller's location.

## Integration Boundaries

- Extract a feature-local unit when logic owns an external API or observer together with its lifecycle, cleanup, and state normalization.
- Keep entry points focused on composition while the extracted unit owns the cohesive behavior; keep presentation details with their owning component or view.
- Normalize invalid or transient external values once at the boundary and expose semantic, valid values to callers.
- Prefer one boundary guard over defensive checks scattered across every consumer.
