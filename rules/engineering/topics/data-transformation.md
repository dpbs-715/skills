# Data Transformation And Field Preservation

Preserve established information unless the operation deliberately narrows it.

## Classify The Boundary First

Decide whether the operation preserves an entity or projects it into a narrower contract before choosing the implementation.

Information-preserving transformations include:

- Copying, enriching, normalizing, or moving the same business entity within the same trust boundary.
- Caching the same entity when the cache's contract is to retain its complete source representation.
- Initializing editable UI, form, store, or workflow state from upstream data.
- Adding derived values, normalized aliases, local identifiers, or interaction state to data that continues downstream.
- Converting data that may later be edited, submitted, persisted, or converted back into the source entity.

Strict projections include:

- API request payloads and protocol contracts.
- Persistence records and serialized cache records governed by an explicit storage schema.
- Permission, privacy, or trust boundaries.
- Exports and intentionally display-only snapshots that will never be edited, submitted, or converted back.

Editable UI models are not display-only projections. After validating or sanitizing data at any trust boundary, preserve the source representation by default if the result continues through the workflow or may return to an upstream boundary.

## Preserve Information By Default

- Start from the complete source representation, then apply intended additions, replacements, or normalization afterward so deliberate overrides win.
- Preserve overwritten source identifiers or values under explicit domain names when both the original and normalized forms are needed.
- Apply the same field-preservation rule recursively to nested business entities and collections.
- Treat field preservation and object ownership as separate concerns. If the destination may edit nested state independently, copy or immutably update the mutable paths according to project conventions so changes cannot mutate the source through shared references.
- Build related information as one cohesive structure and apply it together. Avoid scattered field assignments that split one business operation across multiple mutations.
- Do not rebuild the same entity by enumerating only the fields currently known to the transformation. Upstream fields must not disappear merely because an older transformation does not list them.
- Preserve information at the earliest transformation boundary. A later step cannot recover fields that an earlier step already discarded.

Preferred for an information-preserving transformation whose nested values remain immutable or read-only:

```ts
const normalizeEntity = (source: SourceEntity): EditableEntity => ({
  ...source,
  sourceId: source.sourceId ?? source.id,
  id: createLocalId(source),
  normalizedName: normalizeName(source.name)
})
```

Avoid field-by-field reconstruction of the same entity:

```ts
const normalizeEntity = (source: SourceEntity): EditableEntity => ({
  id: source.id,
  name: source.name,
  status: source.status
})
```

The second form silently drops upstream fields when the source contract evolves.

## Narrow Deliberately

- Select or remove fields only at an explicitly identified strict projection boundary.
- Make narrowing clear in the operation's name, declared contract, or schema; do not hide it inside a generic copy, enrichment, or normalization step.
- At strict boundaries, construct the target contract explicitly and include only supported fields. Do not spread editable UI, internal, or source models directly into the target payload.
- Keep the target contract, transformation, and relevant tests synchronized as the boundary evolves.
- Do not pass internal, sensitive, transient, or presentation-only information across a boundary merely to preserve every field.
- When data crosses several models or components, trace important fields through the complete path and verify that each loss or conversion is intentional.

Preferred at a strict projection boundary:

```ts
const buildSaveRequest = (model: EditableEntity): SaveRequest => ({
  id: model.sourceId,
  name: model.normalizedName
})
```

Avoid leaking the broader model into the boundary:

```ts
const buildSaveRequest = (model: EditableEntity): SaveRequest => ({
  ...model
})
```

## Match The Project's Type Model

- Express stable and important business fields explicitly when that improves clarity, completion, or refactoring safety.
- Open or dynamic data structures are acceptable when the source legitimately carries additional fields that the current feature does not own.
- Choose strict, open, generic, or dynamic types according to the language, framework, and project conventions. Do not impose one language's type mechanism as a universal rule.

## Review Checklist

- Is the result still the same business entity?
- Can it be edited, submitted, persisted, converted back, or passed further downstream?
- Are unknown upstream fields preserved, including inside nested entities?
- If the result is independently editable, does it own the nested mutable state it may change?
- If a field is overwritten, is the original value retained when the workflow still needs it?
- If information is removed, is the strict boundary explicit in the name, type, schema, or contract?
- Does a strict boundary use an allowlist projection instead of spreading a broader model?
