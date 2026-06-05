# dpbs Skills

Personal rules and skills for AI coding agents.

This repository separates always-on preferences from task-specific skills:

- `rules/` contains durable personal or project rules that should guide broad work.
- `skills/` is reserved for task-triggered skill packages.
- `sources/` is reserved for upstream documentation sources used to generate skills.
- `vendor/` is reserved for synchronized third-party skill repositories.

## Current Entries

| Type | Name | Entry |
| --- | --- | --- |
| Rule set | Engineering | [rules/engineering/RULES.md](rules/engineering/RULES.md) |
| Skill shim | Engineering rules | [skills/engineering-rules/SKILL.md](skills/engineering-rules/SKILL.md) |

## Conventions

Rule sets use `RULES.md` as the entry file and keep focused topic documents in `topics/`.

Skills, when added, should use the standard `SKILL.md` layout under `skills/<name>/`.

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
