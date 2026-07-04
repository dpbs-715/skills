# Personal Agent Skills

Personal rules and skills for AI coding agents.

This repository separates always-on preferences from task-specific skills:

- `rules/` contains durable personal or project rules that should guide broad work.
- `skills/` contains hand-written repo-owned skill packages.
- `generated/` contains rendered or synced installable skill bundles that are symlinked into agent directories.
- `vendor/` is reserved for synchronized third-party skill repositories.
- `meta.ts` is the link configuration: which local directory or document sources render into `generated/` (`localSkillSources`), which generated bundles link into agents (`installableSkills`), which document-backed skills are also delivered as always-on instructions (`alwaysOnInstructionSkills`), the per-destination link/config table (`linkTargets`), and vendored skill mappings. Type definitions live in `scripts/lib/metaTypes.ts`.

## Current Entries

| Type | Name | Entry |
| --- | --- | --- |
| Rule set | Engineering | [rules/engineering/RULES.md](rules/engineering/RULES.md) |
| Rule set | Problem solving | [rules/problem-solving/RULES.md](rules/problem-solving/RULES.md) |
| Knowledge index | Personal knowledge | [knowledge/INDEX.md](knowledge/INDEX.md) |
| Source skill | Commit | [skills/commit/SKILL.md](skills/commit/SKILL.md) |
| Source skill | Commit and push | [skills/cpush/SKILL.md](skills/cpush/SKILL.md) |
| Source skill | Diff review | [skills/dcr/SKILL.md](skills/dcr/SKILL.md) |
| Source skill | Push | [skills/push/SKILL.md](skills/push/SKILL.md) |

Run `pnpm skills status` for the live view derived from `meta.ts`: which skills are configured (and why), whether each generated bundle is present in `generated/`, any undeclared generated skill directories, and submodule checkout state.

Run `pnpm skills validate` to check that configured local sources, generated skill shims, skill frontmatter, and repo-local absolute references are still consistent.

## Vendored Skills

This repository follows the same broad pattern as `antfu/skills` for projects that already maintain their own skills:

1. Declare the upstream repository and skills to copy in `meta.ts` under `vendors`.
2. Run the skills manager to add missing submodules.
3. Sync selected upstream skills into `generated/`.

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
pnpm skills sync      # update submodules, then sync vendored skills into generated/
pnpm skills init      # add missing vendor git submodules from meta.ts
pnpm skills check     # fetch submodules and report upstream updates
pnpm skills cleanup   # report unused submodules/generated skills (pass --yes to remove)
pnpm skills validate  # validate local sources, generated skills, and metadata
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

Synced skills in `generated/` get a `SYNC.md` file with the upstream path, repository URL, git SHA, and sync date. Avoid editing synced skill directories by hand; update the vendor submodule and re-run `pnpm skills sync` instead.

## Conventions

Rule sets use `RULES.md` as the entry file and keep focused topic documents in `topics/`.

Hand-written repo-owned skills should use the standard `SKILL.md` layout under `skills/<name>/`.

Document-backed skills, such as rule wrappers or the personal knowledge index wrapper, are declared in `localSkillSources` in `meta.ts`. Their source content stays in `rules/` or `knowledge/`; `pnpm skills link` renders the installable wrapper into gitignored `generated/<name>/SKILL.md` files with this checkout's absolute path.

A directory skill that must reference files outside its own folder can still use the `{{REPO_ROOT}}` placeholder. Edit `skills/<name>/SKILL.md`, never the generated copy, and re-run `pnpm skills link` to regenerate.

Add a skill name to `installableSkills` in `meta.ts` when its generated bundle should be symlinked into local agent skill directories. Add it to `alwaysOnInstructionSkills` when it should also reach Claude or opencode as an always-loaded markdown instruction under their rule directories.

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

The repository keeps local sources under `skills/`, `rules/`, and `knowledge/`, then renders generated bundles under `generated/`. Link configured `installableSkills` into local agent skill directories with:

```bash
pnpm skills link
```

By default this first renders configured `localSkillSources`, then applies the `linkTargets` table from `meta.ts`. Each row is a destination/config file, a `kind`, and what it receives:

| Destination | Kind | Receives |
| --- | --- | --- |
| `~/.codex/skills` | skill | all `installableSkills` |
| `~/.config/opencode/skills` | skill | `installableSkills` minus `alwaysOnInstructionSkills` |
| `~/.config/opencode/rules` | rule | `alwaysOnInstructionSkills`, linked as `<skill>.md` markdown |
| `~/.config/opencode/opencode.json` | json-array | ensures `instructions` includes `~/.config/opencode/rules/*.md` |
| `~/.agents/skills` | skill | all `installableSkills` |
| `~/.claude/skills` | skill | `installableSkills` minus `alwaysOnInstructionSkills` |
| `~/.claude/rules` | rule | `alwaysOnInstructionSkills`, linked as `<skill>.md` markdown |

Skill directories are populated only when they already exist (the tool is installed); missing ones are skipped, not created. Rule directories and JSON config files are created when their parent agent config directory exists.

### Why Claude gets rules instead of skills

Claude auto-loads `~/.claude/rules/*.md` into context every session, whereas skills are invoked only at the model's discretion. Skills listed in `alwaysOnInstructionSkills` (currently the engineering and problem-solving rule sets) are therefore linked into `~/.claude/rules` as markdown pointing at the repo's `RULES.md`, and excluded from `~/.claude/skills`, so they always apply when Claude works. opencode receives the same split, but its `opencode.json` also needs an `instructions` glob for the rules directory; the `json-array` row keeps that configured. Codex and Agents read the rule sets as skills via `~/.codex/skills` / `~/.agents/skills` and are unaffected. `personal-knowledge` stays a skill everywhere — it is task-triggered by design.

Codex documents `~/.agents/skills` as the user-level skill location and supports symlinked skill folders. If two linked skills share the same `name`, Codex does not merge them; both can appear in skill selectors. To avoid duplicate entries, link a skill into only one Codex-scanned user location when possible.

Missing default target directories are skipped, so deleting `~/.agents/skills` keeps `pnpm skills link` from recreating it. Use `--target <path>` when you want to create or update a specific target directory explicitly.

Remove links created by this repository with:

```bash
pnpm skills unlink
```

Use `--target <path>` to link or unlink a specific target directory.
