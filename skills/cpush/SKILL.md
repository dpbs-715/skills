---
name: cpush
description: Use only when explicitly invoked as cpush, c-p, c&p, cnp, commit-push, "commit and push", or when the user asks to commit local repository changes and then push them in one workflow. Reuse commit and push, including push's automatic integration of remote updates for unpublished local commits.
---

# Commit And Push

Read and follow these skills in order; they own commit grouping, verification,
destination resolution, integration, retries, and blockers:

1. `{{REPO_ROOT}}/skills/commit/SKILL.md`
2. `{{REPO_ROOT}}/skills/push/SKILL.md`

Inspect `git status --short --branch`. If there are uncommitted changes, run
the commit workflow, resolving unrelated work as it requires before pushing.
Otherwise skip committing. Then run the push workflow for local commits that
belong at the resolved destination. Do not duplicate the underlying workflows.

Invocation authorizes both phases and the automatic recovery allowed by push.
Forward explicit user restrictions, such as "do not rebase". Remote updates or
`fetch first` / `non-fast-forward` errors go through push's checks and recovery;
stop only at its blocker or retry limit.

Forward `-ch` or `-en` to both skills for message content and the final response;
keep Conventional Commit tokens in English. Use commit's verification policy
without adding another test pass.

Report both phases together using their actual results: branch and destination,
final commit hashes/subjects after any integration, verification, and upstream
equivalent commits when applicable. Say when only a push happened. If committing
succeeded but pushing is blocked, report the retained commits and exact blocker.
If neither phase has work, say there is nothing to commit or push.
