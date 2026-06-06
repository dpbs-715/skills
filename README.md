# dpbs Skills

Personal rules and skills for AI coding agents.

This repository separates always-on preferences from task-specific skills:

- `rules/` contains durable personal or project rules that should guide broad work.
- `skills/` is reserved for task-triggered skill packages.
- `sources/` is reserved for upstream documentation sources used to generate skills.
- `vendor/` is reserved for synchronized third-party skill repositories.
- `meta.ts` records manual entries, source projects, and vendored skill mappings.

## Current Entries

| Type | Name | Entry |
| --- | --- | --- |
| Rule set | Engineering | [rules/engineering/RULES.md](rules/engineering/RULES.md) |
| Skill shim | Engineering rules | [templates/engineering-rules/SKILL.md](templates/engineering-rules/SKILL.md) |

## Vendored Skills

This repository follows the same broad pattern as `antfu/skills` for projects that already maintain their own skills:

1. Declare the upstream repository and skills to copy in `meta.ts` under `vendors`.
2. Run the skills manager to add missing submodules.
3. Sync selected upstream skills into `skills/`.

GSAP is configured as a vendored source:

```bash
pnpm skills init
pnpm skills sync
npm run link
```

The skills manager supports:

```bash
pnpm skills init      # add missing source/vendor git submodules from meta.ts
pnpm skills sync      # update submodules, then sync vendored skills into skills/
pnpm skills check     # fetch submodules and report upstream updates
pnpm skills cleanup   # report unused submodules/skills
pnpm skills cleanup --yes
```

Manual vendor setup is still possible when you want to add a submodule yourself:

1. Add the upstream repository under `vendor/<name>`.
2. Declare the skills to copy in `meta.ts` under `vendors`.
3. Run the vendor sync script directly.

```bash
git submodule add https://github.com/greensock/gsap-skills vendor/gsap
pnpm sync:vendors
npm run link
```

Synced skills get a `SYNC.md` file with the upstream path, repository URL, git SHA, and sync date. Avoid editing synced skill directories by hand; update the vendor submodule and re-run `pnpm sync:vendors` instead.

## Conventions

Rule sets use `RULES.md` as the entry file and keep focused topic documents in `topics/`.

Skills, when added, should use the standard `SKILL.md` layout under `skills/<name>/`.

A skill that must reference files outside its own folder (such as the shared `rules/`) cannot hardcode a portable path, because the skill directory is symlinked into agent locations while its `SKILL.md` is read from arbitrary working directories. Such a skill is defined by `templates/<name>/SKILL.md`, which uses the `{{REPO_ROOT}}` placeholder. `npm run link` renders the template into a gitignored `skills/<name>/SKILL.md` with this checkout's absolute path, then links it — the template itself stays under `templates/` and is never linked into agent directories. Edit the template, never the generated file, and re-run `npm run link` to regenerate.

## Linking Skills

The repository keeps skill source under `skills/`. Link them into local agent skill directories with:

```bash
npm run link
```

By default this links skills into:

- `~/.codex/skills`
- `~/.claude/skills`
- `~/.agents/skills`

Codex documents `~/.agents/skills` as the user-level skill location and supports symlinked skill folders. If two discovered skills share the same `name`, Codex does not merge them; both can appear in skill selectors. To avoid duplicate entries, link a skill into only one Codex-scanned user location when possible.

Remove links created by this repository with:

```bash
npm run unlink
```

Use `-- --target <path>` to link or unlink a specific target directory.
