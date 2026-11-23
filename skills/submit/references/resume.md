# Repeat invocations and resumed submissions

Read this when step 1 finds verified Issues, branches, or PRs/MRs from an
earlier submission of the candidate changes: a repeat invocation, a
continuation after failure, or a prior isolated worktree submission that left
the original changes in place.

Compare candidate changes with the actual content of verified associated
branches and PRs/MRs, including merged results in the target. Use diffs and
commit/patch equivalence, not matching titles or commit hashes alone, to
distinguish already submitted work from new changes. Exclude verified submitted
portions from the new submission scope without changing the original working
tree or index.

- If everything is already submitted, resume only unfinished steps, such as
  opening a missing PR, and return verified results.
- For partial overlap, carry only the verified new changes; ask if they cannot
  be separated reliably.
- Do not reuse a closed or merged PR as an open submission for new work.

Then continue with the remaining scope decisions in step 1. Resume from the
first incomplete step rather than repeating successful writes.
