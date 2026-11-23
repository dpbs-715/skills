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
Read the references below only when their condition applies.

## Invocation and language

```text
$submit
$submit to develop
$submit to develop -ch
/submit to develop -en
/submit -ch to v1.9.0 then merge
/submit -ch to v1.9.0 then test
```

Plain `submit to <target>` leaves the PR/MR open.

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
  review dependencies during preflight.
- `to <first-target> then <final-target>` authorizes both reviewed merges.
  Read [the two-stage merge workflow](references/merge-chain.md) once step 1 finds new work
  or a verified unfinished submission, before asking scope questions, and follow its scope, Issue, branch, and
  worktree cleanup rules. To name a literal second branch called `merge`, use
  `then refs/heads/merge` and resolve that exact branch as the final target.

Invocation authorizes Issue and branch creation, committing, normal pushes,
PR/MR creation, and the scoped local cleanup in step 5 after scope is settled.
Proceed by default without per-phase confirmation. Honor requests to keep the
original changes; they skip step 5. Only an explicit request to preview, show
the plan first, or avoid submission limits the work to inspection and drafting,
with no Git or remote mutations; then read
[the preview workflow](references/preview.md) and follow it instead of writing.
Do not implement new features or rewrite published history.

## 1. Inspect and settle scope

Inspect repository guidance, status, staged and unstaged diffs, relevant untracked
files, and current-branch commits relative to the target. Distinguish already
committed work from new changes. Identify existing Issue/branch/PR associations
from verified repository evidence or user-provided links.

When that finds verified Issues, branches, or PRs/MRs from an earlier
submission of these changes (a repeat invocation, a continuation, or a prior
isolated worktree submission that left the original changes in place), read
[the resume rules](references/resume.md) and follow them before settling scope.

If there are no new changes and no verified submission with unfinished steps,
return verified existing results when applicable or say there is nothing to
submit. Stop before comparing promotion scope or asking about grouping. A clean
checkout with a verified unfinished submission can still resume.

Ask about outstanding scope decisions in a single message before any writes:

- If independent features or fixes need grouping, describe them and ask
  whether to combine them in one Issue, branch, and PR/MR, submit each
  separately, or use a custom grouping. Multiple files, tests, and documentation
  for the same feature do not by themselves require a grouping question.
- Include any scope question required by the two-stage merge workflow.

Use decisions the user has already given. When no decision is needed,
continue directly. Otherwise wait for the outstanding answers before writing.

Map each confirmed group to its files, hunks, and commits. Detect shared changes
or dependencies before promising independent PRs. If those prevent a clean
split, explain the concrete overlap and ask for a revised grouping or explicit
dependent-branch plan. Do not silently include another group's work.

Before the first write, complete one shared preflight for all confirmed groups:

- Verify the underlying skill files, including commit and push, are readable.
- Check Git, the selected platform CLI, and authentication for the resolved host.
  For a GitLab host, read [the GitLab host checks](references/gitlab.md)
  before its API reads, including in previews.
- Resolve the Issue destination, source/push repository, target repository and
  branch, and each group's branch base and transfer plan using the underlying skills.
- Inspect whether each group can reach its branch without losing work or mixing
  scopes. Stop on known conflicts and clarify material ambiguity before creating
  resources; do not repair conflicts as part of preflight.
- For groups submitted from an isolated worktree, record the original checkout,
  branch and HEAD, and the exact index entries and on-disk contents, modes, or
  absence of the paths being transferred. Record which local changes each group
  carries so step 5 can verify them against the pushed result.

Carry forward the verified host, project IDs, branch mapping and CLI
capabilities. Read help for the specific operation when its supported flags
matter. Keep dependent writes in order; review-pr owns the pre-merge refresh of
revisions, approvals, checks, and discussions.

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

Run this step only when groups were submitted from an isolated worktree and the
user did not ask to keep the original changes. After every group has a pushed
source branch and a verified PR/MR, read
[the local cleanup rules](references/cleanup.md) and follow them before
reporting completion, with no extra confirmation or wait for merge. They back
up the original checkout's affected paths before cleaning only verified
duplicates; later or unrelated edits stay in place. Never use a repository-wide
reset or clean.

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
If isolated worktrees were used, report their paths, the step 5 backup path,
the original file paths cleaned, and any retained duplicates and the reason.

On failure, stop subsequent groups and identify completed steps and the blocked
step. Preserve created resources. On continuation, inspect current state and
resume from the first incomplete step rather than repeating successful writes.
