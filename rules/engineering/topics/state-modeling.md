# State Modeling

Choose the representation after understanding the state relationship.

## Ownership And Transitions

- Keep each state owner responsible for one cohesive domain.
- Keep source state minimal and derive views from it instead of synchronizing duplicate representations.
- Model mutually exclusive states with one discriminator rather than several booleans that can contradict each other.
- When transitions preserve invariants, expose readonly state and mutate it through named domain actions.
- Split state owners when their data, transitions, and consumers form independent responsibilities.
- Name the authoritative owner that accepts writes for each business fact. Other layers send commands or read projections rather than independently accepting the same mutation.
- Distinguish local drafts and optimistic views from accepted business state. Define how confirmation or rejection reconciles them without creating a second authoritative queue or cache.

## Asynchronous Ordering And Recovery

For changes involving concurrent writes, retries, streaming, or remote synchronization, make the relevant time semantics explicit:

- Identify when a command is accepted, when it completes, and which owner determines ordering.
- Where delivery can repeat, define the deduplication identity and the effects a retry may repeat.
- Define how cancellation, replacement, or a newer revision prevents late results from overwriting current state.
- For reconnect or replay, identify the authoritative recovery source and how snapshots and subsequent events fit together. Shared state ownership does not imply identical delivery guarantees for every client.
- Use an event sequence or small diagram when ordering is hard to explain. Resolve synchronization through explicit transitions or acknowledgements rather than arbitrary delays.

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
