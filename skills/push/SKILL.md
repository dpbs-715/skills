---
name: push
description: Use only when explicitly invoked as push. Push local git commits to a remote safely.
---

# Git Push

Use this skill to push local commits to a remote.

Do not rewrite remote history unless the user explicitly asks. Prefer clear
status reporting over clever recovery.

## Workflow

1. Inspect `git status --short --branch`.
2. Identify the current branch, upstream, and remote target.
3. Inspect the commits that will be pushed.
4. If there are no local commits to push, say so briefly.
5. Push the current branch to its upstream.
6. If no upstream exists and the remote target is clear, push with
   `--set-upstream`.
7. Report the branch, remote, and pushed commits.

If the working tree has uncommitted changes, mention that they are not part of
the push.

If multiple remotes or targets make the destination ambiguous, ask before
pushing.

## Language

Use `-ch` to respond in Chinese and `-en` to respond in English.

If neither flag is provided, respond in the user's language. Keep branch names,
remote names, commit hashes, commands, and Git terms unchanged.

## Safety

Never use `--force` or `-f` by default.

Use `--force-with-lease` only when the user explicitly requests a force push or
history rewrite. If the branch looks shared or protected, warn before pushing.

Do not pull, merge, rebase, reset, or discard changes while handling a push
unless the user explicitly asks.

If the push is rejected, report the reason and the safest next step. Do not
repair the branch automatically.

## Output

After pushing, respond with:

```md
Pushed `<branch>` to `<remote>/<branch>`.

Commits:
- `<hash>` `<subject>`

Notes:
- ...
```

If nothing was pushed, say:

```md
No commits to push.
```
