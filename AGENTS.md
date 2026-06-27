# Repo Notes

Maintenance gotchas for agents working on **this** repo. Personal coding rules live in the global `engineering-rules` skill, not here.

- `skills/engineering-rules/SKILL.md` is **generated** from `templates/engineering-rules/SKILL.md` by `pnpm skills link`. Edit the template (it uses `{{REPO_ROOT}}`), never the generated file.
- Vendored skills under `skills/` are copied from `vendor/<name>/skills/` by `pnpm skills sync`. Don't hand-edit them — change the vendor submodule and re-sync.
- `meta.ts` is the link config: `templateSkills` (render into `skills/`), `linkedSkills` (link into agent skill dirs), `claudeRules` (delivered to Claude as `~/.claude/rules/*.md` instead of skills), and `linkTargets` (the per-destination table the linker iterates). Skill names come from the `Skill` const object (not a TS `enum` — Node runs these `.ts` in type-stripping mode, which forbids non-erasable syntax).
- Scripts live in `scripts/`: `skills.ts` is the CLI dispatcher (a command registry), each command is a file under `commands/`, and shared plumbing lives in `lib/` — git/submodule, vendor sync, fs helpers, note indexing, validation, plus the linking primitives (`symlink.ts`), skill linking (`skillLinks.ts`), and rule linking (`ruleLinks.ts`). `commands/link.ts` is a thin orchestrator over `linkTargets`. Tests live under `scripts/tests/`; run `npm test`. Lint with `npm run lint`.
- `pnpm skills <command>` is the single entry point (`status`, `link`, `unlink`, `sync`, `init`, `check`, `cleanup`, `validate`, `note`). `pnpm skills link` renders configured templates, then walks `linkTargets`: full `linkedSkills` into `~/.codex/skills` and `~/.agents/skills`, `linkedSkills` minus `claudeRules` into `~/.claude/skills`, and `claudeRules` as markdown into `~/.claude/rules`.
