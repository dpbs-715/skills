---
name: commit
description: Use only when explicitly invoked as commit. Create focused git commits with concise Conventional Commit messages.
---

# Git Commit

Use this skill to turn current repository changes into one or more intentional
git commits.

Do not commit until you understand the changed files. Do not include unrelated
work just because it is present in the working tree.

## Workflow

1. Inspect `git status --short --branch`.
2. Inspect staged, unstaged, and untracked changes.
3. Decide whether the changes form one commit or should be split.
4. Stage only the files or hunks that belong in the commit.
5. Create a concise Conventional Commit message.
6. Commit the staged changes.
7. Report the commit hash and message.

If there are no changes to commit, say so briefly.

If unrelated changes are mixed together, prefer split commits. Ask before
combining unrelated work into one commit.

Never revert, discard, or overwrite user changes unless the user explicitly asks.

## Language

Use `-ch` to write the commit message subject and body in Chinese.
Use `-en` to write the commit message subject and body in English.
Apply the selected language to every split commit in the same request.

Keep Conventional Commit tokens such as type, scope, `!`, and
`BREAKING CHANGE:` in English. If neither flag is provided, use English unless
the user clearly asks for another language.

With `-ch`, write `feat(editor): 支持快捷键配置`. The `feat(editor):`
prefix stays English; the subject after the colon is Chinese.

## Verification

Do not run tests by default. Run tests or validation only when the user asks.

## Commit Message

Use Conventional Commits:

```text
<type>(<scope>): <subject>
```

Keep the subject short, lowercase, imperative, and without a period.

Use a body only when the reason, migration impact, or verification context would
be lost from the subject alone.

Use `!` and a `BREAKING CHANGE:` footer for breaking changes.

## Types

- `feat`: user-visible feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting only, no behavior change
- `refactor`: code change that neither fixes a bug nor adds a feature
- `perf`: performance improvement
- `test`: tests only
- `build`: build system or dependency change
- `ci`: CI configuration or scripts
- `chore`: maintenance that does not affect source or tests
- `revert`: revert a previous commit

## Message Examples

```text
feat(auth): add token refresh
fix(report): preserve empty filter values
docs: clarify skill linking flow
refactor(api)!: rename order endpoints
feat(editor): 支持快捷键配置
fix(report): 保留空筛选值
```

## Output

After committing, respond with:

```md
Committed `<hash>`: `<message>`

Included:
- ...

Verification:
- Not run
```
