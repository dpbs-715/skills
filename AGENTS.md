# Repo Notes

Maintenance gotchas for agents working on **this** repo. Personal coding rules live in the global `engineering-rules` skill, not here.

- `skills/engineering-rules/SKILL.md` is **generated** from `templates/engineering-rules/SKILL.md` by `npm run link`. Edit the template (it uses `{{REPO_ROOT}}`), never the generated file.
- Vendored skills under `skills/` are copied from `vendor/<name>/skills/` by `pnpm sync:vendors`. Don't hand-edit them — change the vendor submodule and re-sync.
- Scripts live in `scripts/`: entry `skills.ts`, operations under `commands/`, shared helpers under `lib/`. Tests are colocated `*.test.ts`; run `npm test`. Lint with `npm run lint`.
- `npm run link` symlinks every `skills/<name>` into `~/.codex`, `~/.claude`, and `~/.agents`.
