# Two-stage merge

`submit -ch to v1.9.0 then test` submits the development changes into `v1.9.0`,
then promotes the remote `v1.9.0` branch into `test`. Close resolved Issues
and clean up their development branches after the final integration.

## Preflight

- Accept one `then` separator after `to <first-target>`. Require two distinct
  branch names. Validate both refs and confirm they exist as remote branches in
  the resolved target repository before the first write. Preserve the verified
  source repository mapping for each development branch, including forks.
- Read `{{REPO_ROOT}}/skills/review-pr/SKILL.md` and its dependencies. Keep the
  usual submit grouping, language, preview, and worktree boundaries. A preview
  includes both MR directions and the conditions for final Issue, worktree, and branch
  cleanup. Mark remote facts that cannot be verified in preview.
- When this submission creates a temporary worktree, record its repository,
  exact path, Issue, and development branch in the task history. Record the
  original checkout separately. Carry these details forward on retry. A matching
  path or branch name alone does not establish who created a worktree.

## Merge the first requests

Use submit to create or reuse each Issue, development branch, and first-leg
PR/MR. Use related references and retain the verified Issue and request links.
Run review-pr through its merge verification for each first request. Defer
Issue closure and branch deletion to the final step below.

Before each merge in this workflow, check automatic Issue closure and
source-branch deletion. Keep Issue references non-closing and disable any
per-request source-branch removal when merging. Check existing requests,
commit messages, and applicable platform behavior for automatic effects that
would violate this timing or remove a branch the workflow must keep. Stop if
those effects cannot be avoided through an authorized per-request merge.

Run the reviews and merges under the repository's normal approval, check,
discussion, and revision requirements. Monitor running required checks or a
required merge queue within the current invocation and recheck the revision
before continuing. If a required check fails or progression needs an approval
or other action, report the blocked stage with its link. Start the final leg
only after every first request is verifiably merged.

## Promote into the final target

Refresh both remote refs. Verify that the first target contains the submitted
changes, accounting for squash or rebase merges. Use create-pr with the
first-target branch as source and the final-target branch as target in the
verified target repository. The handoff is remote-only. Use the remote source
revision and exclude local version-branch edits, commits, and pushes.

Reuse a matching open promotion PR/MR after verifying its full diff and scope.
For a new request, include non-closing links to the first-leg requests and the
verified Issues. Review the entire promotion diff and identify any additional
version changes. Stop if it would include changes outside the authorized
promotion. Use review-pr to review, merge, and verify the remote result, with
Issue closure still deferred. On continuation, reuse a verified matching merged
promotion for the same submission. If there is no promotion diff, skip the
empty request and verify that the final branch already contains the submitted
changes before proceeding.

## Close Issues and clean up development branches

Verify the submitted changes are present in the final remote target. Follow
review-pr's Issue verification and closure step for the original verified
Issues. Close only Issues fully resolved in the final target under repository
policy and verify their closed state. Leave incomplete Issues and their branches
in place.

For each closed Issue, clean up only its verified development branch. Check
that its current tip matches the first merge's verified source revision and
that it has no other open request or unintegrated work. Keep both target branches
and any default, protected, or shared branch. If the remote ref still exists,
delete only that exact ref from the verified source remote with a revision
guard. With Git, use an explicit lease on the deletion refspec:

```sh
git push --force-with-lease=refs/heads/<branch>:<verified-sha> <source-remote> :refs/heads/<branch>
```

Verify the remote branch is gone. Before deleting the local branch, inspect
the recorded temporary worktree from the original checkout. Use
`git worktree list --porcelain` to verify its path, branch, lock state, and
HEAD against the recorded worktree and the first merge's verified source revision.
Keep original, pre-existing, user-retained, locked, or repurposed worktrees.
If ownership or current state is uncertain, leave the worktree in place.

Check the worktree for an in-progress Git operation and use
`git -C "<path>" status --porcelain=v1 --untracked-files=all --ignored --ignore-submodules=none`
to detect staged, unstaged, untracked, or ignored files. If the checks succeed,
the status is empty, and no operation is in progress, run
`git worktree remove -- "<path>"` from the original checkout without force.
If Git refuses removal, keep the worktree and report why. Recheck the worktree
list and path after removal. On retry, skip a worktree already absent from both.

Refresh the worktree list. Clean up a local branch only when it has no
unintegrated work, is unused by every worktree, and normal `git branch -d`
permits removal. Report branches that are already absent or must be kept. Keep
the user's current checkout and any local work intact.

Report both merge stages, the original Issues and their verified closure state,
and the branches and temporary worktrees removed, already absent, or kept with
the reason. On retry, reconstruct progress from the
verified associations, remote requests, and branch state. Resume only remaining
work. If the original associations are ambiguous, ask for the Issue or request
link before writing anything.
