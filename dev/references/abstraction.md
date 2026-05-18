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
