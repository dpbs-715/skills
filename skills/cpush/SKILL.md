---
name: cpush
description: Use only when explicitly invoked as cpush, c-p, c&p, cnp, commit-push, "commit and push", or when the user asks to commit local repository changes and then push them in one workflow. Reuse commit and push, including push's automatic integration of remote updates for unpublished local commits.
---

# Commit And Push

Use this skill to run the existing commit workflow and then the existing push
workflow as one user-facing action.

This is an orchestration skill. Do not duplicate or reinterpret the detailed
rules from the underlying skills. Read and follow them in order:

1. `{{REPO_ROOT}}/skills/commit/SKILL.md`
2. `{{REPO_ROOT}}/skills/push/SKILL.md`

## Workflow

1. Inspect `git status --short --branch`.
2. If there are uncommitted changes, follow the `commit` skill to create one or
   more intentional commits.
3. If there are no uncommitted changes, skip the commit phase.
4. Follow the `push` skill to push any local commits that should go to the
   resolved destination, including its preflight fetch, automatic integration,
   and bounded retry rules.
5. Report both phases together.

If the commit phase discovers unrelated work, use the `commit` skill's split or
ask behavior before pushing anything.

Invocation authorizes both phases and the automatic recovery allowed by `push`.
Do not stop merely because the remote has new commits or Git returns
`fetch first` / `non-fast-forward`; follow `push` to check and recover. Forward
explicit user restrictions such as "do not rebase" to the push phase. Stop only
when its checks or retry limit leave a specific blocker.

If there are no uncommitted changes and no local commits to push, say there is
nothing to commit or push.

## Language

Forward language flags to both phases:

- `-ch`: use Chinese for the commit message content and final response.
- `-en`: use English for the commit message content and final response.

Apply the selected language to every commit created during the commit phase.
Keep Conventional Commit tokens such as `feat`, `fix`, scopes, `!`, and
`BREAKING CHANGE:` in English.

## Verification

Use the verification behavior from the `commit` skill. Do not run tests by
default unless the user asks or the repository instructions require it before
commit.

## Output

After a successful commit and push, respond with:

```md
Committed and pushed `<branch>` to `<remote>/<branch>`.

Commits:
- `<hash>` `<subject>`

Verification:
- Not run

Notes:
- ...
```

If only a push happened, say so explicitly.

After integration, report the final commit hashes and any commits already
present upstream, following `push`. If commit succeeded but push is blocked,
report the retained commits and exact blocker; do not claim full success.

If nothing happened, say:

```md
Nothing to commit or push.
```
