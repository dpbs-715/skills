# Maintenance

Day-to-day upkeep of this checkout: authoring conventions, vendored skills,
status and validation, private knowledge notes, and local skill feedback. For
how sources are installed into agent tools, see [Rendering and linking](linking.md).

## Authoring Conventions

- Hand-written repo-owned skills use the standard `SKILL.md` layout under
  `skills/<name>/`.
- Rule sets use `RULES.md` as the entry file and keep focused topic documents in
  `topics/`. Keep brief, broadly applicable decision checks and conditional
  routing in the entry; keep detailed task workflows and their outputs in
  skills. For example, the engineering entry starts with scope, routes to
  `build-what-is-needed`, and adds `before-you-build` only for uncertain product
  demand, value, or adoption.
- Rules delivered through global context (`agent-routing`,
  `project-workspaces`, `skill-feedback`) also have a short `ENTRY.md` that is
  written into managed instruction sections.
- Write maintained skill and rule instructions in English.

Communication preferences live in
[rules/communication/RULES.md](../rules/communication/RULES.md). Codex, Pi, and
Antigravity receive the full document in a managed global context section;
Claude Code and OpenCode receive it through their always-on rule directories;
Kimi Code keeps it as a discoverable skill without an always-on entry. Edit the
source and run `pnpm skills link` to refresh installed copies without replacing
surrounding user instructions.

## Vendored Skills

This repository follows the same broad pattern as `antfu/skills` for upstream
projects that maintain their own skills:

1. Declare the upstream repository and the skills to copy in `meta.ts` under
   `vendors`. The source directory defaults to `skills/`; set `skillsDir` for
   another layout, such as `.well-known/agent-skills/`.
2. Run `pnpm skills init` to add missing submodules under `vendor/<name>`.
3. Run `pnpm skills sync` to update the submodules and copy the selected skills
   into `generated/`, then `pnpm skills link`.

```bash
pnpm skills init
pnpm skills sync
pnpm skills link
```

You can also add a submodule yourself, declare its skills under `vendors`, and
sync:

```bash
git submodule add https://github.com/greensock/gsap-skills.git vendor/gsap-skills
pnpm skills sync
pnpm skills link
```

`sync` updates vendor submodules before copying; it does not simply use the
commits pinned by the main repository. Each synced skill in `generated/` gets a
`SYNC.md` with the upstream path, repository URL, Git SHA, and sync date. Do not
edit synced skill directories by hand; update the vendor submodule and re-run
`pnpm skills sync`. `pnpm skills check` fetches submodules and reports upstream
updates.

`vendor/ui-designer-skills/` is a committed snapshot rather than a submodule; its
skills are declared as directory sources in `localSkillSources`. Vendored
submodule sources are available locally after `pnpm skills init`; only the
skills selected in `vendors` or `localSkillSources` are used.

## Status, Validation, and Cleanup

- `pnpm skills status` shows the live view derived from the effective
  configuration: which skills are configured and why, whether each generated
  bundle exists in `generated/`, undeclared generated skill directories, and
  submodule checkout state.
- `pnpm skills validate` checks that configured local sources, generated skills
  and agents, team dependencies, skill frontmatter (parsed as YAML), local
  Markdown link destinations, evaluation fixtures, and repo-local absolute
  references are consistent. See [Skill evaluations](skill-evaluations.md) for
  the difference between fixture checks and model behavior evaluations.
- `pnpm skills cleanup` reports unused vendor submodules and undeclared
  generated skill directories; `--yes` removes them. Cleanup skips a vendor
  checkout with local changes (including ignored files), commits not reachable
  from known remote refs, a Git database inside the checkout, or state it cannot
  read. Tracked submodules are removed with non-force `git submodule deinit` and
  `git rm`, which keep the submodule's Git database for recovery. Skipped
  entries stay registered and produce a nonzero exit status. Remote refs are
  local evidence only; cleanup does not fetch or prove publication elsewhere.
- Code checks: `pnpm test`, `pnpm lint`, and `pnpm typecheck`.

## Knowledge Notes

Private reusable notes live under `knowledge/notes/`, with `knowledge/INDEX.md`
as the lightweight index rendered into the `personal-knowledge` skill. Both are
Git-ignored. A fresh checkout must run `pnpm skills note reindex` before
`pnpm skills link` to create its own index.

```bash
pnpm skills note list
pnpm skills note reindex
pnpm skills note add command-notes/example --title "Example" --summary "Short reusable note." --tag commands
```

`note reindex` scans Markdown files under `knowledge/notes/`, skips hidden
directories such as `.obsidian`, preserves existing summaries and tags when
possible, and rewrites `knowledge/INDEX.md`. `note add` creates a new note and
refuses to overwrite an existing one.

## Skill Feedback

The [Skill Feedback rule](../rules/skill-feedback/RULES.md) tells agents when
and how to record a reproducible defect in a maintained skill, rule, or role,
which fields to include, what to leave out, and when to remove a report after a
verified fix. `pnpm skills link` installs its short entry in the global
instructions for Codex, Pi, and Antigravity and the full rule in Claude Code and
OpenCode rule directories; Kimi Code receives it as a discoverable skill.

Enable local collection once per trusted personal checkout:

```bash
pnpm skills feedback enable
pnpm skills feedback status
pnpm skills feedback report --input <private-json-file>
pnpm skills feedback disable
```

- `--input -` reads the JSON report from standard input.
- The checkout-local `local/skill-feedback/enabled` marker controls collection.
  `disable` stops collection without deleting existing reports; a report that
  has already passed its final opt-in check may still finish.
- Reports are Markdown files under the Git-ignored
  `local/skill-feedback/reports/`. A report must name an existing,
  checkout-local maintained source file. For the same component, source,
  operation, and failure, the command returns the existing report path instead
  of overwriting it.
- The command refuses symlinks along the storage path and creates new feedback
  directories and files with owner-only Unix permissions. Use a checkout whose
  files and directories you control: it does not audit access control lists or
  protect against another process moving or replacing directories during a
  write.
- Collection is local only. It does not contact GitHub, check upstream
  revisions, or create Issues.
