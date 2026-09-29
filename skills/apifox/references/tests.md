# Cases, scenarios and execution

Use `test-case` for endpoint-specific cases, `test-scenario` for ordered business
flows, and `test-suite`/`run` for execution. Discover current commands and schemas
rather than writing payloads from remembered field names.

For single-interface cases, resolve the endpoint and a valid case category in
the selected project. If available, read a comparable case as a structural
reference. Preserve steps, processors, extractors, assertions and array members
when updating. Validate payloads and get the saved case; a successful create
alone does not prove it is visible under the expected client category.

For scenarios, plan inputs, step dependencies, assertions and cleanup first.
Prefer the CLI's import/reference operations for existing endpoints, cases and
scenarios rather than hand-building their internal binding fields. Read the
expanded scenario after changes and ensure it contains meaningful steps.
Replace schema example values with suitable business values; do not treat an
empty scenario as completed automation.

Resolve the environment, branch, test data and side effects before execution.
Read-only inspection of a case does not authorize running its requests. Preserve
an explicit user request to run tests and ask only for missing consequential
context. Use the same project key throughout setup, execution and report lookup.

Inspect assertion outcomes and failed steps, not just the process exit code.
Distinguish local reports from uploaded reports and summary uploads from step
details. If upload fails after execution, preserve the local report and report
that split outcome; do not rerun side-effecting tests merely to upload a report.
Do not publish report data outside the requested scope.
