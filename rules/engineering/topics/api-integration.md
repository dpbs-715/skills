# API Integration

When replacing mock or static data with a real API:

- Treat API fields as the source of truth. Trace each old field through displays, calculations, conditions, filters, child components, charts, dialogs, and drill-down parameters.
- If only the name changed, replace the field and all references directly. Do not keep the old name through one-to-one aliases or adapters.
- Preserve existing behavior and recheck units, nulls, enums, and ranges.
- Add derived values or adapters only for real semantic changes such as conversion, normalization, aggregation, cross-API composition, or temporary compatibility; keep them at the data boundary and name the changed meaning clearly.
- Verify uncertain mappings instead of guessing from similar names. Remove obsolete mock and compatibility code after integration.
