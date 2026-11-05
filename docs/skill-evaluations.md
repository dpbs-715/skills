# Skill evaluations

`npm test` and `pnpm skills validate` check local evaluation JSON, matching skill
names, unique IDs, required case fields, assertions when present, and portable
input files. They do not run a model or establish that a skill behaves correctly.

Keep behavior cases in `skills/<name>/evals/evals.json`. Each case has `id`,
`prompt`, `expected_output`, `files`, and preferably short, independently
checkable `assertions`. Input files are relative to the skill bundle. Keep
trigger cases in `evals/trigger-evals.json` as an array of `query` and boolean
`should_trigger` entries. Include near misses that share vocabulary but need a
different workflow, alongside positive cases.

For a behavior evaluation:

1. Select the cases affected by the change. Snapshot the old skill bundle before
   editing when comparing versions; keep both versions' input fixtures identical.
2. Run old and updated versions in separate, fresh agent contexts using the same
   model and tool inventory. Give each run its skill path and case input. Use
   temporary repositories and fake CLIs for workflow cases; never use live
   credentials, real remote writes, database writes, or SSH as evaluation fixtures.
3. Save each run's output and action evidence outside the skill source, then
   grade each assertion against that evidence. Distinguish observed tool calls
   from a plan that merely says the right thing. Check trigger cases using the
   normal skill catalog; do not force-load the candidate skill for those runs.
4. Report model, cases, passes/failures, untested boundaries, and whether the run
   checked simulated plans or actual execution. Review failures before updating
   instructions; repeat affected cases after changes.

Start with first pushes, preview versus Draft state, coordinating skill calls,
scope/credential selection, and recovery after partial failure. Keep model
evaluation opt-in: ordinary unit tests remain deterministic and offline.
