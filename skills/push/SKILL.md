---
name: push
description: Use only when explicitly invoked as push or called by a coordinating skill such as cpush. Push local commits, automatically integrating remote updates when only unpublished local commits need rebasing.
---

# Git Push

Push local commits to the resolved remote branch. Invocation authorizes fetching,
rebasing unpublished local commits under the conditions below, and normal pushes
without another confirmation. Honor explicit restrictions such as "do not rebase"
or "push only". Keep published history and uncommitted work intact.

## Workflow

1. Inspect `git status --short --branch`, the current branch, upstream, remote
   URLs, and push configuration. Stop for detached HEAD or an existing merge,
   rebase, cherry-pick, or revert operation; do not take over that operation.
2. Resolve one push remote and destination branch from the user's request and
   repository configuration, including push-specific remote/refspec settings.
   If the destination is ambiguous, ask before pushing. Do not assume `origin`,
   a same-named branch, or that the upstream and push destination are identical.
3. Record existing remote-tracking tips as publication evidence, then fetch the
   resolved destination and refresh its remote-tracking ref. Use the actual
   destination ref for all comparisons and recovery. If a previously known
   target was rewound or replaced, stop and report the history change. A
   fetch/auth/network failure is a blocker, not evidence that the branch does
   not exist. Confirm a missing remote branch before treating it as a new push.
4. For an existing destination, inspect the commits and compare with
   `git rev-list --left-right --count HEAD...<target-ref>`. The first count is
   local-only commits; the second is remote-only commits. Follow this table:

   | Local-only | Remote-only | Action |
   | --- | --- | --- |
   | 0 | 0 | Nothing to push. |
   | 0 | greater than 0 | Report that the branch is behind with no local commits to push; leave local HEAD unchanged. |
   | greater than 0 | 0 | Inspect and push the outgoing commits normally. |
   | greater than 0 | greater than 0 | Apply Automatic Integration before pushing. |

5. For a confirmed new destination, inspect the outgoing history against its
   known branch base. Ask if the intended commit scope cannot be established.
6. Push explicitly to the resolved branch, for example
   `git push <remote> HEAD:refs/heads/<branch>`, so configuration cannot send
   additional branches or select a different destination. Add `--set-upstream`
   when there is no upstream and the tracking target is clear; preserve an
   existing upstream unless the user requests changing it.
7. Handle rejection using Rejected Pushes, then report the actual result.

Uncommitted changes do not prevent a normal push of existing commits. Mention
that they are excluded; they do prevent automatic integration.

## Automatic Integration

Remote updates are a routine part of push/cpush. Continue automatically when all
of these checks pass:

- The index and working tree are clean, including untracked files, and no Git
  operation is in progress.
- The target and HEAD share a known merge base. If history is shallow or the
  base cannot be established, stop and report what is missing.
- The local-only range is linear; it contains no merge commits. Do not flatten
  merges or choose a new merge strategy automatically.
- Every commit to replay is unpublished according to available repository
  evidence. Refresh branch refs for all configured remotes before checking;
  if a required fetch fails, stop. For each commit in
  `git rev-list <target-ref>..HEAD`, check containment with
  `git for-each-ref --contains <commit> refs/remotes refs/tags` and any known
  publication evidence from the session. Also check reachability from the
  remote-tracking tips recorded before fetching, since updates can remove refs
  that proved publication. A containing ref or known publication blocks
  automatic rebase. Empty results cover the inspected refs, not unknown
  repositories or deleted refs; do not claim universal proof of non-publication.
- The user and repository instructions permit this integration.

If a check fails, explain the specific blocker and the next action needed.
Do not ask for confirmation merely because a clean, unpublished branch diverged.

When eligible:

1. After refreshing refs, recheck the counts and eligible range. Record the
   original HEAD, target commit, merge base, and outgoing commit subjects.
2. Run `git -c rebase.autoStash=false -c rebase.updateRefs=false rebase <target-ref>`.
   Use the explicit fetched target and keep other local branch refs unchanged;
   do not use an implicit `git pull` or create a merge commit.
3. If conflicts occur, record the conflicted paths, then run `git rebase --abort`
   to restore the state before this skill's rebase. Report the conflict and stop
   without pushing. Do not choose a side, skip commits, or edit business code.
   If abort fails, report the remaining operation and stop without resetting.
4. After success, inspect the rebased commits and compare the old and new ranges
   with `git range-diff <old-base>..<old-head> <target-commit>..HEAD`. Account for
   commits Git skipped because their changes already exist upstream. Stop on
   unexpected content changes or lost work. Recompute outgoing commits and use
   their final hashes in the result; rebase can change hashes or leave none to
   push.
5. Push normally if outgoing commits remain. Automatic integration never
   requires a force push. Follow applicable verification requirements; this
   skill adds no default test run.

## Rejected Pushes

Classify the actual Git/server error before choosing a response:

- `fetch first` or `non-fast-forward`: fetch the destination again and recheck
  the graph. Apply Automatic Integration if eligible, then retry a normal push.
  If the refreshed target already contains HEAD, report that no commits remain
  to push. Stop if the fetched state does not explain the rejection.
- Authentication, permission, protected-branch, hook/policy, or network failure:
  report the specific cause and next step. Rebase does not fix these failures;
  do not bypass hooks, change targets, or suggest force push as a generic fix.

Allow at most one automatic rebase and two push attempts per invocation,
including any integration before the first push. If the remote advances again
and another rebase would be needed, stop with the latest status and preserve
local commits. Do not loop indefinitely.

## Language

Use `-ch` to respond in Chinese and `-en` to respond in English.

If neither flag is provided, respond in the user's language. Keep branch names,
remote names, commit hashes, commands, and Git terms unchanged.

## Safety

Never use `--force` or `-f` by default.

Use `--force-with-lease` only when the user explicitly requests a force push or
history rewrite. If the branch looks shared or protected, warn before pushing.

The automatic rebase above is limited to unpublished local history. Other
history changes require explicit user direction. Do not reset, discard changes,
auto-stash, amend commits, or bypass hooks to make a push succeed.

## Output

After pushing, respond with:

```md
Pushed `<branch>` to `<remote>/<branch>`.

Commits:
- `<hash>` `<subject>`

Notes:
- ...
```

Include any automatic integration and relevant skipped commits in Notes. Report
only final commit hashes, and distinguish pushed commits from commits already
present remotely.

If nothing needs pushing, say:

```md
No commits to push.
```

If blocked, report the intended branch/remote, whether integration occurred,
retained local commits, the specific blocker, and the next action needed.
Do not report a rejected or blocked push as "No commits to push."
