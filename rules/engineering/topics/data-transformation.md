# Data Transformation And Field Preservation

Preserve established information unless the operation deliberately narrows it.

## Preserve Information By Default

- Treat copying, enrichment, normalization, and conversion of the same business entity as information-preserving transformations by default.
- Start from the complete source representation, then apply only the intended additions, replacements, or normalization using the language and project's established approach.
- Build related information as one cohesive structure and apply it together. Avoid scattered field assignments that split one business operation across multiple mutations.
- Avoid repeatedly rebuilding the same entity from the fields currently known at each transformation step. Upstream fields must not disappear merely because an older transformation does not list them.
- Preserve information at the earliest transformation boundary. A later step cannot recover fields that an earlier step already discarded.

## Narrow Deliberately

- Select or remove fields only when the operation intentionally creates a narrower representation, such as an API contract, persistence model, permission or privacy boundary, or display-only view.
- Make narrowing clear in the operation's name, declared contract, or schema; do not hide it inside a generic copy, enrichment, or normalization step.
- At strict boundaries, include only supported fields and keep the contract, transformation, and relevant tests synchronized as the data evolves.
- Do not pass internal, sensitive, transient, or presentation-only information across a boundary merely to preserve every field.
- When data crosses several models or components, trace important fields through the complete path and verify that each loss or conversion is intentional.

## Match The Project's Type Model

- Express stable and important business fields explicitly when that improves clarity, completion, or refactoring safety.
- Open or dynamic data structures are acceptable when the source legitimately carries additional fields that the current feature does not own.
- Choose strict, open, generic, or dynamic types according to the language, framework, and project conventions. Do not impose one language's type mechanism as a universal rule.
