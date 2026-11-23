# Antigravity Compatibility

## Official References

The integration follows Antigravity's current official documentation:

- [Customization discovery](https://antigravity.google/docs/customization-discovery/)
- [Rules](https://antigravity.google/docs/rules/)
- [Skills](https://antigravity.google/docs/skills/)
- [Custom subagents](https://antigravity.google/docs/subagents/)
- [Permissions](https://antigravity.google/docs/permissions/)
- [MCP](https://antigravity.google/docs/mcp/)

The current shared customization directory serves Antigravity App, CLI, and IDE.
Older releases use different paths; the official skills page explicitly retains
the legacy IDE skill directory. File installation is not proof that an older
installed product implements every feature in the current documentation.

Gemini CLI-specific installation and role generation are deliberately out of
scope. The `~/.gemini/GEMINI.md` file used by Antigravity is also readable by
Gemini CLI, but this repository does not install its dedicated skill or agent
directories. Existing shared `~/.agents/skills` links may independently be
discoverable by other tools.

## Antigravity Locations

| Content | Global | Project |
| --- | --- | --- |
| Instructions | `~/.gemini/GEMINI.md`; also supports `AGENTS.md` and configuration-directory instruction files | `AGENTS.md`, `GEMINI.md`, and instruction files under `.agents/` |
| Skills | `~/.gemini/config/skills/` | `.agents/skills/` |
| Agents | `~/.gemini/config/agents/*.md` or `<name>/agent.md` | `.agents/agents/*.md` or `<name>/agent.md` |
| MCP candidates | `~/.gemini/config/mcp_config.json` | `.agents/mcp_config.json` |

Antigravity also recognizes `.agent/`, `_agents/`, and `_agent/` as project
customization directories. Use `.agents/` for new projects. Its IDE retains
`~/.gemini/antigravity/skills/` as a legacy global skill location. Its CLI also
loads `~/.gemini/skills/` and `~/.gemini/antigravity-cli/skills/`; the App does
not read those CLI-specific global skill directories. Do not install duplicate
legacy copies automatically: use the current shared directory, and explicitly
adjust a private target if an older installation requires another path.

Antigravity scans project customizations in the workspace and its parent
folders up to the repository root, not arbitrary descendant directories. It
supports `skills.json`, `rules.json`, and `agents.json` discovery manifests for
additional locations. `project inspect` reports these paths and the supported
aliases without opening their contents or claiming that any MCP server is
connected. Agents must still check applicable nested project instructions.

## What This Repository Installs

`meta.template.ts` keeps existing hosts and adds Antigravity:

- Four managed sections in `~/.gemini/GEMINI.md`: the full communication rules
  and short entries for role routing, project discovery, and skill feedback.
- Normal skills plus the on-demand engineering and problem-solving rules in
  `~/.gemini/config/skills/`. The four globally delivered rule skills are
  excluded from this directory to avoid duplicate entries.
- Native role definitions in `~/.gemini/config/agents/`.
- Desktop App `read_file` grants for the checkout's `skills/`, `agents/`,
  `rules/`, and `generated/` directories. Linking adds them to
  `userSettings.globalPermissionGrants.allow` in `~/.gemini/config/config.json`.
  This includes the generated personal knowledge index. The source notes under
  `knowledge/` and private integration data under `local/` are outside these grants.
  Unlinking preserves existing permissions. For an older installation, follow
  the [permission migration](upgrading-local-meta.md#antigravity).

The skills use the existing `SKILL.md` bundles, and roles use the same
`agents/<name>/AGENT.md` and `agent.json` sources. Generated output remains
private to the checkout. Never edit `generated/` by hand. Role rendering rebuilds
its owned `generated/agents/` tree, removing output for retired host formats.

The Antigravity skill target sets `createIfParentExists: true`: linking may
create `skills/` under an existing `~/.gemini/config` directory. It does not
create that host configuration parent. Other skill targets retain the existing
skip-missing-directory behavior. Agent directories are likewise created only
when their immediate parent exists. The global instruction sections require
an existing `~/.gemini` parent.

Antigravity requires valid YAML `trigger` metadata for modular `rules/*.md`
files. A generated skill wrapper's `name` and `description` are not sufficient.
This integration therefore uses managed sections in `GEMINI.md`, not raw
Claude-style rule symlinks or incompatible `@file` import syntax. Re-linking
updates each section once; unlinking removes only managed sections and links,
preserving surrounding instructions, foreign files, and configuration.

### Native Role Format

Antigravity roles include `name`, `description`, `subagent: true`, and
`mainAgent: false`. They are delegatable specialist roles, not replacements for
the primary chat agent. The body includes shared role instructions, shared-rule
references, and explicit absolute paths to relevant generated skills. Role-only
skills remain readable by path, not installed into the general skill list.

No model, tool allowlist, MCP configuration, or shell execution policy is
prescribed; native host defaults and user permissions still apply. The linker
does not change authentication, model preferences, MCP definitions, trust,
sandbox settings, or other tool permissions. Installing a role does not prove that a
particular product version exposes a working delegation tool.

## Local Configuration

An existing `meta.ts` is never replaced with the template. To add Antigravity,
preserve existing unrelated targets and add:

1. The four `markdown-section` rows for `~/.gemini/GEMINI.md`.
2. The `skill` row for `~/.gemini/config/skills`.
3. The `agent` row for `~/.gemini/config/agents` with `format: 'antigravity'`.
4. The `json-array` row for the desktop permission grants in `~/.gemini/config/config.json`.

No Gemini CLI-specific targets are needed. Removing a host format from rendering
does not delete that tool's own files or third-party installations outside this
checkout.

## Verification

Run the repository checks and link from the skills checkout:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm skills link
pnpm skills validate
```

Tests cover the native role format, retired generated-format cleanup, paths
containing spaces, creation under existing host parents, missing-host skips,
absence of Gemini CLI-specific installation, safe re-linking/unlinking,
configuration preservation, and project discovery. These are filesystem and
rendering checks, not live model-behavior tests.

For runtime discovery, inspect rather than automatically execute a model task:

- **Antigravity App:** inspect the project's Customizations section in Settings
  and the installed Skills & Rules list. Check that item paths belong to this
  checkout and the intended global configuration directory.
- **Antigravity IDE:** open the agent side panel's **Customizations** menu and
  inspect loaded skills and rules. Availability of native custom agents depends
  on the installed release and exposed tools.
- **Antigravity CLI:** `/skills` and `/agents`; `/skills reload` refreshes the
  skill list and slash commands.

Do not report native discovery or successful delegation solely because files
were rendered and linked. A new conversation or product restart may be needed
by the installed release. Existing duplicate or foreign installations must be
resolved through their owning manager, not overwritten to make linking pass.
