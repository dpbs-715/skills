# dpbs Skills

Personal rules and skills for AI coding agents.

This repository separates always-on preferences from task-specific skills:

- `rules/` contains durable personal or project rules that should guide broad work.
- `skills/` is reserved for task-triggered skill packages.
- `vendor/` is reserved for synchronized third-party skill repositories.
- `meta.ts` is the link configuration: which templates render into `skills/` (`templateSkills`), which skills link into agents (`linkedSkills`), which skills Claude receives as rules instead of skills (`claudeRules`), the per-destination link table (`linkTargets`), and vendored skill mappings.

## Current Entries

| Type | Name | Entry |
| --- | --- | --- |
| Rule set | Engineering | [rules/engineering/RULES.md](rules/engineering/RULES.md) |
| Rule set | Problem solving | [rules/problem-solving/RULES.md](rules/problem-solving/RULES.md) |
| Skill shim | Engineering rules | [templates/engineering-rules/SKILL.md](templates/engineering-rules/SKILL.md) |
| Skill shim | Personal knowledge | [templates/personal-knowledge/SKILL.md](templates/personal-knowledge/SKILL.md) |
| Skill shim | Problem solving rules | [templates/problem-solving-rules/SKILL.md](templates/problem-solving-rules/SKILL.md) |

Run `pnpm skills status` for the live view derived from `meta.ts`: which skills are configured (and why), whether each is present in `skills/`, any undeclared skill directories, and submodule checkout state.

Run `pnpm skills validate` to check that configured templates, generated skill shims, Claude rule sources, skill frontmatter, and repo-local absolute references are still consistent.

## Vendored Skills

This repository follows the same broad pattern as `antfu/skills` for projects that already maintain their own skills:

1. Declare the upstream repository and skills to copy in `meta.ts` under `vendors`.
2. Run the skills manager to add missing submodules.
3. Sync selected upstream skills into `skills/`.

For a configured vendored source, the normal flow is:

```bash
pnpm skills init
pnpm skills sync
pnpm skills link
```

Everything is one command — `pnpm skills <command>`:

```bash
pnpm skills status    # show configured skills, their roles, and submodule state
pnpm skills link      # symlink configured skills into local agent skill directories
pnpm skills unlink    # remove skill symlinks created by this repo
pnpm skills sync      # update submodules, then sync vendored skills into skills/
pnpm skills init      # add missing vendor git submodules from meta.ts
pnpm skills check     # fetch submodules and report upstream updates
pnpm skills cleanup   # report unused submodules/skills (pass --yes to remove)
pnpm skills validate  # validate templates, generated skills, rules, and metadata
pnpm skills note      # manage private knowledge notes (list, reindex, add)
```

Run `pnpm skills` with no arguments to see this list.

Manual vendor setup is still possible when you want to add a submodule yourself:

1. Add the upstream repository under `vendor/<name>`.
2. Declare the skills to copy in `meta.ts` under `vendors`.
3. Run the vendor sync script directly.

```bash
git submodule add https://github.com/greensock/gsap-skills vendor/gsap
pnpm skills sync
pnpm skills link
```

Synced skills get a `SYNC.md` file with the upstream path, repository URL, git SHA, and sync date. Avoid editing synced skill directories by hand; update the vendor submodule and re-run `pnpm skills sync` instead.

## Conventions

Rule sets use `RULES.md` as the entry file and keep focused topic documents in `topics/`.

Skills, when added, should use the standard `SKILL.md` layout under `skills/<name>/`.

A skill that must reference files outside its own folder (such as the shared `rules/`) cannot hardcode a portable path, because the skill directory is symlinked into agent locations while its `SKILL.md` is read from arbitrary working directories. Such a skill is defined by `templates/<name>/SKILL.md`, which uses the `{{REPO_ROOT}}` placeholder. Add its name to `templateSkills` in `meta.ts`; `pnpm skills link` renders configured templates into gitignored `skills/<name>/SKILL.md` files with this checkout's absolute path. The template itself stays under `templates/` and is never linked into agent directories. Edit the template, never the generated file, and re-run `pnpm skills link` to regenerate.

Add a skill name to `linkedSkills` in `meta.ts` when it should be symlinked into local agent skill directories. A skill can exist in `skills/` without being linked. Add it to `claudeRules` (with its `RULES.md` source) when it should instead reach Claude as an always-loaded rule under `~/.claude/rules`; it then continues to link as a skill for the other agents.

## Knowledge Notes

Private reusable notes live under `knowledge/notes/`, with `knowledge/INDEX.md` as the lightweight index used by the `personal-knowledge` skill. These files are gitignored by default.

Use the note workflow to keep that index fresh:

```bash
pnpm skills note list
pnpm skills note reindex
pnpm skills note add command-notes/example --title "Example" --summary "Short reusable note." --tag commands
```

`note reindex` scans markdown files under `knowledge/notes/`, skips hidden directories such as `.obsidian`, preserves existing summaries and tags when possible, and rewrites `knowledge/INDEX.md`. `note add` creates a new note and refuses to overwrite an existing one.

## Linking Skills

The repository keeps skill source under `skills/`. Link configured `linkedSkills` into local agent skill directories with:

```bash
pnpm skills link
```

By default this first renders configured `templateSkills`, then applies the `linkTargets` table from `meta.ts`. Each row is a destination, a `kind`, and the skills it receives:

| Destination | Kind | Receives |
| --- | --- | --- |
| `~/.codex/skills` | skill | all `linkedSkills` |
| `~/.agents/skills` | skill | all `linkedSkills` |
| `~/.claude/skills` | skill | `linkedSkills` minus `claudeRules` |
| `~/.claude/rules` | rule | `claudeRules`, linked as `<skill>.md` markdown |

Skill directories are populated only when they already exist (the tool is installed); missing ones are skipped, not created. The Claude rules directory is created when `~/.claude` exists.

### Why Claude gets rules instead of skills

Claude auto-loads `~/.claude/rules/*.md` into context every session, whereas skills are invoked only at the model's discretion. Skills listed in `claudeRules` (currently the engineering and problem-solving rule sets) are therefore linked into `~/.claude/rules` as markdown pointing at the repo's `RULES.md`, and excluded from `~/.claude/skills`, so they always apply when Claude works. Codex and Agents read them as skills via `~/.codex/skills` / `~/.agents/skills` and are unaffected. `personal-knowledge` stays a skill everywhere — it is task-triggered by design.

Codex documents `~/.agents/skills` as the user-level skill location and supports symlinked skill folders. If two linked skills share the same `name`, Codex does not merge them; both can appear in skill selectors. To avoid duplicate entries, link a skill into only one Codex-scanned user location when possible.

Missing default target directories are skipped, so deleting `~/.agents/skills` keeps `pnpm skills link` from recreating it. Use `--target <path>` when you want to create or update a specific target directory explicitly.

Remove links created by this repository with:

```bash
pnpm skills unlink
```

Use `--target <path>` to link or unlink a specific target directory.
