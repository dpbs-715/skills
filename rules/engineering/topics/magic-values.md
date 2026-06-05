# Magic Values

Name values with domain meaning; keep obvious local literals inline.

Extract:

- Status codes, type codes, protocol values, business limits, timeouts.
- Values reused in multiple places, or values whose change requires knowing why.

Keep inline:

- Obvious local literals like `0`, `1`, `true`, `false`, `""`.
- Names that only restate the literal.

Place:

- Shared contracts: centralized constants.
- Environment-specific values: config/env/schema.
