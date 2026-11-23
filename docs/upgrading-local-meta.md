# Upgrading a Local `meta.ts`

`meta.ts` is private to each checkout and is never overwritten by
`pnpm skills init` or by template updates. When `meta.template.ts` gains new
defaults, merge the parts you want into your local file, then run
`pnpm skills link`. This page collects one-off migration notes. For what each
setting does, see [Rendering and linking](linking.md).

A quick way to find what changed:

```bash
git diff <old-revision> -- meta.template.ts
diff meta.template.ts meta.ts
```

## Revisions That Tracked `meta.ts`

Older revisions committed `meta.ts`. Before pulling past that change, back up
the file outside the checkout, then restore it afterward as your local
configuration.

## Adding a New Local Skill

For a directory skill such as `server-ops`, add its key to the `Skill` const
object and its entry to `localSkillSources` if absent, for example:

```ts
ServerOps: 'server-ops',
// ...
{ kind: 'directory', name: Skill.ServerOps, path: 'skills/server-ops' },
```

The shared defaults already include `server-ops`. Its private inventory
(`local/server-ops/servers.yaml`) stays outside generated skill bundles.

## Skill Feedback

Copy the `SkillFeedback` key in `Skill` and the `skill-feedback` document source
from `meta.template.ts`, then add the settings for your hosts:

- **Codex, Pi, and Antigravity:** copy their `skill-feedback` markdown-section
  rows and add `Skill.SkillFeedback` to `contextRuleSkills` (or your equivalent
  filter). This keeps the rule out of ordinary skill directories, including
  `~/.agents/skills`, because it already loads through global instructions.
- **Claude Code and OpenCode:** add `Skill.SkillFeedback` to
  `alwaysOnInstructionSkills` so the rule loads automatically.

Then enable collection if you want it; see [Maintenance](maintenance.md#skill-feedback).

## Antigravity

Preserve unrelated targets and add the Antigravity rows listed in
[Antigravity compatibility](antigravity.md#local-configuration): four
`~/.gemini/GEMINI.md` markdown sections, the `~/.gemini/config/skills` skill row,
the `~/.gemini/config/agents` agent row, and the `config.json` json-array row.

If the existing Antigravity row includes `read_file({{REPO_ROOT}})`, replace its
`include` list with the four directory grants from the template and run
`pnpm skills link`. In the App's permission settings, remove the old
`read_file(<absolute checkout path>)` grant. Verify that the four directory
grants remain and that the checkout root is absent. Both `link` and `unlink`
preserve existing JSON array entries.

## OpenCode

The template configures two OpenCode configuration entries in addition to
the skill, rule, and agent directories: the `instructions` json-array row and
the `permission.external_directory` json-object row in
`~/.config/opencode/opencode.json`. Before copying the json-object row, check
your existing `opencode.json`: it sets `'*': 'ask'` and replaces any different
value already stored under those keys. `unlink` does not remove these entries.

## Apifox Credentials

Apifox tokens now live in this checkout's `local/apifox/credentials.json`. The
former `~/.config/apifox-skills/credentials.json` location is no longer read
automatically and requires an explicit migration; see the
[connection contract](../skills/apifox-init/references/connection.md). The
previous upstream Apifox submodule was replaced by the local `apifox` and
`apifox-init` skills. If an old `meta.ts` still declares it under `vendors`,
remove that entry; `pnpm skills cleanup` then reports the leftover submodule.
