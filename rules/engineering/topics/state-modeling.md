# State Modeling

Choose the representation after understanding the state relationship.

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
