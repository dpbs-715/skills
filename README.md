# dpbs Skills

Personal rules and skills for AI coding agents.

This repository separates always-on preferences from task-specific skills:

- `rules/` contains durable personal or project rules that should guide broad work.
- `skills/` is reserved for task-triggered skill packages.
- `vendor/` is reserved for synchronized third-party skill repositories.
- `meta.ts` records which templates render into `skills/`, which skills link into agents, and vendored skill mappings.

## Current Entries

| Type | Name | Entry |
| --- | --- | --- |
| Rule set | Engineering | [rules/engineering/RULES.md](rules/engineering/RULES.md) |
| Skill shim | Engineering rules | [templates/engineering-rules/SKILL.md](templates/engineering-rules/SKILL.md) |
| Skill shim | Personal knowledge | [templates/personal-knowledge/SKILL.md](templates/personal-knowledge/SKILL.md) |

Run `pnpm skills status` for the live view derived from `meta.ts`: which skills are configured (and why), whether each is present in `skills/`, any undeclared skill directories, and submodule checkout state.

## Vendored Skills

This repository follows the same broad pattern as `antfu/skills` for projects that already maintain their own skills:

1. Declare the upstream repository and skills to copy in `meta.ts` under `vendors`.
2. Run the skills manager to add missing submodules.
3. Sync selected upstream skills into `skills/`.

For a configured vendored source, the normal flow is:

```bash
pnpm skills init
pnpm skills sync
npm run link
```

The skills manager supports:

```bash
pnpm skills status    # show configured skills, their roles, and submodule state
pnpm skills init      # add missing vendor git submodules from meta.ts
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

A skill that must reference files outside its own folder (such as the shared `rules/`) cannot hardcode a portable path, because the skill directory is symlinked into agent locations while its `SKILL.md` is read from arbitrary working directories. Such a skill is defined by `templates/<name>/SKILL.md`, which uses the `{{REPO_ROOT}}` placeholder. Add its name to `templateSkills` in `meta.ts`; `npm run link` renders configured templates into gitignored `skills/<name>/SKILL.md` files with this checkout's absolute path. The template itself stays under `templates/` and is never linked into agent directories. Edit the template, never the generated file, and re-run `npm run link` to regenerate.

Add a skill name to `linkedSkills` in `meta.ts` when it should be symlinked into local agent skill directories. A skill can exist in `skills/` without being linked.

## Linking Skills

The repository keeps skill source under `skills/`. Link configured `linkedSkills` into local agent skill directories with:

```bash
npm run link
```

By default this first renders configured `templateSkills`, then links configured `linkedSkills` into whichever of these target directories already exist:

- `~/.codex/skills`
- `~/.claude/skills`
- `~/.agents/skills`

Codex documents `~/.agents/skills` as the user-level skill location and supports symlinked skill folders. If two linked skills share the same `name`, Codex does not merge them; both can appear in skill selectors. To avoid duplicate entries, link a skill into only one Codex-scanned user location when possible.

Missing default target directories are skipped, so deleting `~/.agents/skills` keeps `npm run link` from recreating it. Use `-- --target <path>` when you want to create or update a specific target directory explicitly.

Remove links created by this repository with:

```bash
npm run unlink
```

Use `-- --target <path>` to link or unlink a specific target directory.
