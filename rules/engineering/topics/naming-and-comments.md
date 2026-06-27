# Naming And Comments

Make simple code explain itself.

## Prefer

- Names that make call sites readable.
- Methods named by domain action, not vague mechanics.
- Parameters that explain what is being passed.
- Small structure changes over explanatory comments.

## Avoid

- Comments that translate obvious code.
- Names like `handle`, `process`, `data`, `item`, or `value` when a domain name exists.
- Boolean or numeric arguments that are unclear at the call site.
- Comments used to excuse confusing names or tangled flow.

## Comment When

- The reason is outside the code: external constraints, compatibility, history, trade-offs, surprising edge cases, or workaround removal conditions.
