# Repo Notes

Maintenance gotchas for agents working on **this** repo. Personal coding rules live in the global `engineering-rules` skill, not here.

- `skills/engineering-rules/SKILL.md` is **generated** from `templates/engineering-rules/SKILL.md` by `pnpm skills link`. Edit the template (it uses `{{REPO_ROOT}}`), never the generated file.
- Vendored skills under `skills/` are copied from `vendor/<name>/skills/` by `pnpm skills sync`. Don't hand-edit them — change the vendor submodule and re-sync.
- `meta.ts` uses `templateSkills` for templates that render into `skills/` and `linkedSkills` for skills that should be linked into agent directories.
- Scripts live in `scripts/`: `skills.ts` is the CLI dispatcher (a command registry), each command is a file under `commands/`, and shared plumbing (git/submodule, vendor sync, fs helpers) lives in `lib/`. Tests live under `scripts/tests/`; run `npm test`. Lint with `npm run lint`.
- `pnpm skills <command>` is the single entry point (`status`, `link`, `unlink`, `sync`, `init`, `check`, `cleanup`). `pnpm skills link` renders configured templates, then symlinks configured `linkedSkills` into `~/.codex`, `~/.claude`, and `~/.agents`.
