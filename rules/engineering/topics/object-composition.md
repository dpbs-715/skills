# Object Composition And Field Preservation

Preserve an object's established information unless the operation deliberately narrows it.

## Preserve, Then Override

- When copying, enriching, or normalizing the same domain object, spread the source first, then add related information and override only fields whose names, formats, or values actually change.
- Build one complete addition or override object and merge it once. Avoid scattered mutations and repeated field-by-field reconstruction of the same object.
- Treat a transformation as information-preserving by default. A field added upstream must not disappear merely because an older mapper does not list it.
- Preserve fields at the earliest transformation boundary. Spreading an object later cannot recover fields already discarded by an earlier reconstruction.

Prefer:

```ts
const relatedInfo = {
  warehouseCode: warehouse.code,
  warehouseName: warehouse.name
}

const normalized = {
  ...source,
  ...relatedInfo,
  plateNumber: source.plateNumber ?? source.carNumber
}
```

Avoid rebuilding the object from the fields currently known to one caller when the result is still the same resource:

```ts
const normalized = {
  id: source.id,
  plateNumber: source.carNumber
}
```

## Deliberate Projection And External Boundaries

- Select fields one by one only when the operation is an intentional projection, such as a strict API DTO, persistence schema, permission boundary, privacy filter, or display-only model.
- Make narrowing visible in the function name and return type, such as `toSaveRequest` or `pickPublicProfile`; do not hide it inside a generic copy or normalize helper.
- At a strict external boundary, return a typed DTO and whitelist only contract-supported fields. When the contract evolves, update the DTO, mapper, and relevant tests together.
- Do not blindly spread UI-only, internal, sensitive, or transient fields into an external request merely to avoid maintaining its contract.
- Trace fields through source models, view models, related objects, child inputs, and submit models whenever data crosses several transformations.

## Type Choices

- Define stable, important business fields explicitly when doing so improves completion, refactoring, or contract clarity.
- Open objects may use `[key: string]: any`, `Record<string, any>`, or an existing `any`-based alias when they intentionally preserve and pass through fields that are dynamic, supplied by a framework, or not owned by the current feature.
- Use `unknown` instead of `any` when callers should validate or narrow dynamic values before using them. Use `any` when unrestricted access is an accepted and useful trade-off; do not ban it mechanically.
- Known fields and an open index signature can coexist when a model needs typed core properties while retaining additional data.

```ts
type ResourceRow = {
  id: number | string
  deliveryCode?: number | string
  [key: string]: any
}
```

- When preserving the exact input type is valuable, a generic return type provides stronger inference than an open index signature. Use `Omit<T, keyof Overrides> & Overrides` when overrides replace existing field types.

```ts
const mergeRelatedInfo = <T extends object, Overrides extends object>(
  source: T,
  overrides: Overrides
): Omit<T, keyof Overrides> & Overrides => ({
  ...source,
  ...overrides
})
```

- Add frequently used business fields to the explicit type even when an open index signature exists, so their names and expected values remain discoverable.
