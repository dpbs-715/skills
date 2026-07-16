# State Modeling

Choose the representation after understanding the state relationship.

## Ownership And Transitions

- Keep each state owner responsible for one cohesive domain.
- Keep source state minimal and derive views from it instead of synchronizing duplicate representations.
- Model mutually exclusive states with one discriminator rather than several booleans that can contradict each other.
- When transitions preserve invariants, expose readonly state and mutate it through named domain actions.
- Split state owners when their data, transitions, and consumers form independent responsibilities.

## Bit Flags

Use when multiple states can exist together and be freely composed.

Example: `visible + editable + required`

Avoid when:

- States are mutually exclusive: use enum/tagged union.
- There are only one or two simple switches: use boolean.
- States carry complex data: use objects/structs.

## Naming

- `hasAll`: all requested flags must be present.
- `hasAny`: any requested flag may be present.
- Avoid vague names like `hasState`.
- Do not scatter bitwise operations in business code; wrap them in helpers/domain methods.
