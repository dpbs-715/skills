# Import and export

Resolve direction, format, selected project, branch, and resource scope first.
Use the installed `import --help` or `export --help`. A request to export should
produce a file and does not authorize importing it somewhere else.

For generated OpenAPI, inspect existing generators/specifications in the code
repository. Verify operations, parameters, request/response schemas, references
and meaningful tags against the source rather than delivering a list of paths
with empty bodies. A schema example is not evidence of production behavior.

Before importing, identify whether matching resources will be updated,
overwritten, skipped or duplicated under the selected mode. Resolve module
mapping ambiguities using IDs and actual module lists. Do not silently create
a new project or change credentials to obtain a clean import destination.

Use the applicable CLI schema validation when the command exposes one, and
validate the input format before execution. After import, inspect created,
updated, skipped and failed counts; read representative resources on the same
project/branch. High skip counts need explanation, not a success claim based
solely on exit status. Native-format exports and reports can include environment
or request secrets; keep artifacts in the requested location and avoid printing
raw payloads or publishing files without authorization.
