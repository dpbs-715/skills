# Clean up verified local duplicates

Read this for step 5 when groups were submitted from an isolated worktree and
the user did not ask to keep the original changes. It applies only to the
duplicate uncommitted changes carried from the original checkout to isolated
worktrees, using the state recorded during preflight.

## Verify coverage

Start only after every group has a pushed source branch and a verified PR/MR.
Verify the current remote source tips contain those exact changes, accounting
for any rebase during push. Use the published diff or file content as evidence.
Issue or branch creation alone is insufficient. Run this step before reporting
completion, with no extra confirmation or wait for merge.

Recheck the original branch and HEAD and compare each candidate path's index
entry and on-disk state with the recorded state. Only clean paths whose staged
and unstaged changes are fully accounted for by the verified submission. Treat
both sides of a rename as one unit.

Keep paths with unrelated or later edits, paths with ambiguous staged changes,
and paths whose recorded state or remote coverage cannot be verified.

## Back up before writing

Before restoring or deleting anything in the original checkout, save the exact
current state of the paths about to be cleaned:

1. Resolve the original checkout's Git directory with
   `git -C "<original>" rev-parse --absolute-git-dir` and create a new
   `submit-backup/<UTC-timestamp>/` directory inside it (normally
   `.git/submit-backup/<timestamp>/`). Never reuse or overwrite an existing
   backup directory.
2. Record the original branch, HEAD SHA, and the exact repository-relative path
   for each candidate. Use literal pathspecs and a filename-safe manifest.
3. For each path, record its index state independently of its working-tree state.
   For an ordinary stage-zero entry, save its mode, object ID and raw blob
   (`git cat-file blob <oid>`); verify the saved bytes with
   `git hash-object --no-filters`. Record index absence explicitly. Keep paths
   with special index flags, unresolved stages, or submodules in place.
4. Snapshot the working-tree entry for every candidate, including tracked files.
   Copy regular files byte-for-byte with their modes. For a symlink, save the
   link target itself, including dangling targets. Record an absent entry
   explicitly. Verify the saved type, bytes or link target, and mode against
   the original. Git diffs can normalize these bytes through clean filters.
5. If the backup cannot be completed and verified, make no cleanup writes
   and report the retained duplicates.

Do not delete the backup as part of this workflow.

## Clean only verified paths

For tracked or staged paths, restore only those literal file paths in the index
and working tree to the recorded HEAD. For a submitted untracked file, remove
only that exact file after verifying its current content and mode. Recheck
immediately before writing and verify the result afterwards.

Keep the original checkout in place. Never use a repository-wide reset or
clean. If a cleanup operation fails, check what actually changed before
retrying and report any duplicates that remain. A retry may clean only paths it
can still verify, and creates a new backup before its own writes.

## Report

Report the absolute backup directory, the paths actually cleaned, any retained
duplicates with the reason, and how to restore the cleaned paths. From the
original checkout at the recorded branch and HEAD, first check that those
paths still match their post-cleanup state. Preserve any later edits.

For each cleaned path, use its entry in the reported backup. For saved index
blobs, run `git hash-object -w --no-filters -- "<saved-blob>"`, verify the
returned ID, then run `git update-index --add --cacheinfo <mode> <oid> "<path>"`
from the checkout root. For recorded index absence, remove only that path
from the index with `git update-index --force-remove -- "<path>"`.
Restore the working-tree entry independently from its raw copy, link target,
or recorded absence, then verify both layers against the backup.
