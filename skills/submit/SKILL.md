---
name: submit
description: Submit existing changes through an Issue, associated branch, commit/push, and PR or MR. Use for /submit, $submit, or requests for this workflow. Use to <target> then merge to review and merge into that target, or to <first> then <final> for two reviewed merges and final cleanup. Ask how to group independent features before making changes. Exclude generic form submission, feature implementation, and standalone commit, push, Issue, or PR requests.
---

# Submit

Requires Git and either GitHub CLI (`gh`) or GitLab CLI (`glab`).

Turn existing changes into one or more reviewable PRs/MRs with associated Issues
and branches. Load the applicable workflow instructions once per submission.
Batch independent reads with the initial repository inspection. On continuation,
load the skills for the remaining stages and reuse verified results from earlier
stages. The underlying skills are:

- `{{REPO_ROOT}}/skills/create-issues/SKILL.md`
- `{{REPO_ROOT}}/skills/cpush/SKILL.md` (including its commit and push dependencies)
- `{{REPO_ROOT}}/skills/create-pr/SKILL.md`

This skill coordinates scope, grouping, and handoffs. Keep platform commands,
templates, metadata, duplicate checks, and verification in the underlying
skills. The explicit handoffs below specialize their standalone branch behavior.

## Invocation and language

```text
$submit
$submit to develop
$submit to develop -ch
/submit to develop -en
/submit -ch to v1.9.0 then merge
/submit -ch to v1.9.0 then test
```

Use the current working tree and relevant current-branch commits as input.
Recognize `-ch` and `-en` anywhere and remove them before parsing the targets.
Default to English; `-ch` selects Chinese and `-en` selects English. Forward
the selected flag to every underlying skill. Apply it to Issue and PR/MR titles
and authored bodies, commit message content, and results. Preserve identifiers,
required template text, and Conventional Commit tokens as the underlying
skills require.

Resolve the target from the explicit argument, then a documented project
submission target, then the repository's actual default branch. Validate refs
and remote mappings using create-pr; do not guess main, master, or origin.

With `then`, require an explicit target and exactly one operand after `then`.
Resolve incomplete or extra stages before any writes. Match the exact lowercase
operand `merge` before interpreting the operand as a branch:

- `to <target> then merge` authorizes review and merge of each group's PR/MR
  into that target. Load `{{REPO_ROOT}}/skills/review-pr/SKILL.md` and its
  review dependencies during preflight. For a preview, describe the review
  and merge conditions and keep the entire workflow read-only.
- `to <first-target> then <final-target>` authorizes both reviewed merges.
  Read [the two-stage merge workflow](references/merge-chain.md) before
  preflight and follow its Issue, branch, and worktree cleanup rules. To name
  a literal second branch called `merge`, use `then refs/heads/merge` and
  resolve that exact branch as the final target.

Invocation authorizes Issue and branch creation, committing, normal pushes,
PR/MR creation, and the scoped local cleanup in step 5 after scope is settled.
Proceed by default without per-phase confirmation. Honor requests to keep the
original changes. Only an explicit request to preview, show the plan first, or
avoid submission limits the work to inspection and drafting, with no Git or
remote mutations. Ordinary submission ends after opening the PR/MR and
cleaning verified local duplicates. Do not implement new features or rewrite
published history.

## 1. Inspect and settle scope

Inspect repository guidance, status, staged and unstaged diffs, relevant untracked
files, and current-branch commits relative to the target. Distinguish already
committed work from new changes. Identify existing Issue/branch/PR associations
from verified repository evidence or user-provided links.

On repeat invocations, compare candidate changes with the actual content of
verified associated branches and PRs/MRs, including merged results in the target.
This matters when a prior isolated worktree submission left the original changes
in place. Use diffs and commit/patch equivalence, not matching titles or commit
hashes alone, to distinguish already submitted work from new changes. Exclude
verified submitted portions from the new submission scope without changing the
original working tree or index. If everything is already submitted, resume
only unfinished steps, such as opening a missing PR, and return verified results.
For partial overlap, carry only the verified new changes; ask if they cannot be
separated reliably. Do not reuse a closed or merged PR as an open submission for
new work.

If multiple independent features or fixes are present and the user has not
already specified their grouping, list them with a short description and ask
one consolidated question:

- Combine them into one Issue, one branch, and one PR/MR.
- Separate them into one Issue, branch, and PR/MR per feature.
- Use a custom grouping supplied by the user.

Wait for the answer before creating Issues or branches, staging, committing,
or pushing. Never choose a grouping because the user has not replied. Multiple
files, implementation plus tests, or documentation for the same feature do not
by themselves require this question. Honor grouping already given in this task.

Map each confirmed group to its files, hunks, and commits. Detect shared changes
or dependencies before promising independent PRs. If those prevent a clean
split, explain the concrete overlap and ask for a revised grouping or explicit
dependent-branch plan. Do not silently include another group's work.

If there is no work to submit, return verified existing results when applicable
or say there is nothing to submit; do not create empty Issues or PRs/MRs.

Before the first write, complete one shared preflight for all confirmed groups:

- Verify the underlying skill files, including commit and push, are readable.
- Check Git, the selected platform CLI, and authentication for the resolved host.
- Resolve the Issue destination, source/push repository, target repository and
  branch, and each group's branch base and transfer plan using the underlying skills.
- Inspect whether each group can reach its branch without losing work or mixing
  scopes. Stop on known conflicts and clarify material ambiguity before creating
  resources; do not repair conflicts as part of preflight.
- For groups submitted from an isolated worktree, record the original checkout,
  branch and HEAD, and the exact index entries and on-disk contents, modes, or
  absence of the paths being transferred. Record which local changes each group
  carries so step 5 can verify them against the pushed result.

Collect independent read-only checks together, including the local diff,
target refs, and any additional commits a second merge would carry. Use those
results to settle grouping and promotion scope in the same user question when
both need a decision. Carry forward the verified host, project IDs, branch
mapping and CLI capabilities. Read help for the specific operation when its
supported flags matter. Keep dependent writes in order and refresh the remote
revision, approvals, checks and discussions immediately before merging.

For GitLab API reads in a checkout bound to the intended server, use glab's
repository context and verify the project ID and namespace. A self-managed
server can advertise a clone URL with a different hostname from the configured
remote. Verify that both identify the intended project before proceeding.
Use normal branch and MR endpoints for the current user's permissions and
merge status. Query administrative settings only when they answer an outstanding
requirement. Leave nonessential metadata to its owning skill. For preview-only requests, missing authentication does not block a local
draft; identify remote facts that could not be verified.

For an explicit preview request, produce one consolidated plan for all groups:
Issue drafts or verified existing Issues, planned branches and bases, commit
scopes and proposed messages, and PR/MR drafts with source and target repositories.
Use placeholders for Issue numbers that do not exist yet. Apply the underlying
skills' drafting guidance without entering their write phases or stopping at
separate per-skill previews. Return the complete plan and stop. If the user later
authorizes submission, revalidate relevant state and continue without asking for
the same approval again.

## 2. Create or reuse each Issue and associated branch

Process confirmed groups sequentially. Resolve Issue and branch reuse separately:

- Reuse an explicitly supplied or verified associated Issue covering the group;
  create an Issue only when one is missing.
- Reuse a suitable verified associated branch. If the Issue exists but its branch
  does not, follow only create-issues' associated-branch workflow using that Issue;
  do not create another Issue.
- If a suitable branch already exists but its Issue is missing, create the Issue
  and associate that branch using the platform's supported mechanism instead of
  unconditionally creating another branch. Check that this association is supported
  during preflight; if it is not, plan a new associated branch and transfer the group.
  Verify the association before proceeding.

A search hit or an existing branch name alone is not an established association.
Follow create-issues for duplicate ambiguity; ask only when suitability or the
association cannot be resolved from evidence.

For a new Issue, derive its problem, scope, and acceptance criteria from the
actual group, then follow create-issues. Resolve the branch base and how the
group's changes will reach it before creating the Issue. Use the resolved PR/MR
target as the base unless repository evidence or an approved dependency plan
requires a different base. Do not lose existing source-only commits by branching
from the target and forgetting to transfer them.

The confirmed submission scope authorizes carrying that group's changes to its
associated branch when conflict-free; do not ask again merely because the work
is uncommitted. This specializes create-issues' standalone dirty-worktree prompt.
Its batch no-checkout default does not apply to sequential submission of confirmed
groups. Preserve the original work through publication. Use isolated worktrees
when needed to apply only the group's patches or commits; verify the resulting
diff before committing. Do not stash, discard, reset, overwrite, or force-push
user work. Stop on conflicts or an ambiguous transfer instead of repairing
history or broadening the group without authorization.

## 3. Commit and push on the Issue branch

Verify the branch is associated with this group's Issue and that its diff and
outgoing commits contain only the confirmed scope. Run cpush on that branch,
passing the selected language and group scope. Never run an initial cpush on
the PR/MR target branch. Already committed changes do not need another commit.

Follow commit's verification rules and repository-required checks. Do not run
tests merely because this wrapper was invoked or claim unperformed checks.

## 4. Create the linked PR/MR

Run create-pr with the explicit associated source branch, resolved target,
Issue reference, and selected language. Its push phase should recognize the
already synchronized branch. In ordinary submission and `then merge`, use a closing Issue
reference only when the PR/MR completes the Issue. Use a non-closing reference
for partial work and for every request in the two-stage merge workflow.

Reuse a matching open PR/MR instead of creating a duplicate. Do not change its
title, body, or target without authorization. Attach created PRs to the current
task when the environment provides that capability.

## 5. Clean up verified local duplicates

After every group has a pushed source branch and a verified PR/MR, clean up the
duplicate uncommitted changes that were carried from the original checkout to
isolated worktrees. Verify the current remote source tips contain those exact
changes, accounting for any rebase during push. Use the published diff or file
content as evidence. Issue or branch creation alone is insufficient. Run this
step before reporting completion, with no extra confirmation or wait for merge.

Recheck the original branch and HEAD and compare each candidate path's index
entry and on-disk state with the recorded state. Only clean paths whose staged
and unstaged changes are fully accounted for by the verified submission. For
tracked or staged paths, restore only those literal file paths in the index and
working tree to the recorded HEAD. For a submitted untracked file, remove only
that exact file after verifying its current content and mode. Treat both sides
of a rename as one unit. Recheck immediately before writing and verify the
result afterwards.

Keep paths with unrelated or later edits, paths with ambiguous staged changes,
and paths whose recorded state or remote coverage cannot be verified. Keep the
original checkout in place. Never use a repository-wide reset or clean. If a
cleanup operation fails, check what actually changed before retrying and report
any duplicates that remain. A retry may clean only paths it can still verify.

## Completion and recovery

After step 5, for `then merge`, pass each verified PR/MR link and the selected
language to review-pr. Follow its review, guarded merge, remote verification,
and resolved-Issue rules. Report the link and actual outcome for each group.
If a required check or approval blocks a merge, identify the pending request
and reason. On retry, reuse verified requests and resume unfinished work even
if the checkout is clean. This mode adds no promotion or branch cleanup step.

For two named targets, continue with the two-stage guide after step 5.
Verified previous requests can resume the remaining stages with a clean checkout.

Report each group's Issue URL, branch and target, commit identifiers, PR/MR URL,
and actual verification result. Distinguish created resources from reused ones.
If isolated worktrees were used, report their paths, what was cleaned from the
original checkout, and any duplicates left there with the reason.

On failure, stop subsequent groups and identify completed steps and the blocked
step. Preserve created resources. On continuation, inspect current state and
resume from the first incomplete step rather than repeating successful writes.
