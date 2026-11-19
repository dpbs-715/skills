---
name: dcr
description: Review git diffs with findings-first code review.
---

# Diff Code Review

Use this skill for focused diff review. Review the changed behavior, not the
entire codebase.

Do not edit files unless the user explicitly asks for fixes. Do not produce
broad refactor advice unless the risk is introduced by the diff.

## Language

Use `-ch` to respond in Chinese and `-en` to respond in English.

If neither flag is provided, respond in the user's language. Keep code symbols,
file paths, commands, and severity labels unchanged.

## Review Target

If the user provides a diff, patch, commit, branch, or range, review that target.

If no target is provided:

- Inspect `git status --short --branch`.
- Review current working tree changes, including both staged and unstaged diffs.
- Inspect relevant untracked files listed by `git ls-files --others --exclude-standard`; ordinary Git diffs do not include their contents. Treat new source, tests, and configuration in the requested scope as part of the review.
- State which staged, unstaged, and untracked changes were included. If a relevant file cannot be inspected, report that gap.
- Say there is nothing to review only when there are no relevant tracked changes or untracked files.

When reviewing pasted diffs without repository context, state that the review is
limited to the supplied diff.

## Review Execution

Review directly by default, including changes implemented in the current session.
When the user requests an independent review, or a specific risk warrants a
second opinion, use an uninvolved reviewer if available. Honor requests to
review directly. Give the reviewer the repository path, review target,
requirements, known checks, and the question to answer. The reviewer applies
this skill and returns evidence without editing files or delegating further.
The lead agent verifies the findings and owns the complete review. If a
requested independent review is unavailable, disclose the fallback.

## Follow-up Reviews

Review the full requested diff on the first pass. On a follow-up, use the
previously reviewed snapshot and findings to identify everything that changed
since that pass. Verify each claimed fix against its original failure case.
Review all intervening changes, including edits unrelated to the fix, and trace
their effects into callers or data contracts where behavior could change.

Carry forward conclusions for unaffected behavior. Reopen a settled point
when a change or new evidence calls it into question. If the previous review
coverage or snapshot cannot be established, review the full current target.
Finish when the prior concerns have a clear status and the intervening changes
and their effects have been assessed. Report any remaining verification gaps.

## Required Context

Do not rely on the diff alone when repository context is available. Read enough
surrounding code to understand the changed behavior.

Inspect affected files, nearby call sites, relevant tests, types, schemas,
configuration, and data contracts as needed. Use search tools to trace renamed
symbols, changed APIs, and behavior that crosses file boundaries.

## Review Priorities

Prioritize concrete risks:

- correctness bugs
- behavior regressions
- security issues
- data integrity risks
- async, concurrency, cache, and state bugs
- API or compatibility breaks
- missing or misleading tests
- error handling and edge cases
- maintainability risks introduced by the diff

Avoid style, naming, formatting, and preference comments unless they create a
real bug or meaningful maintenance risk.

## Finding Rules

Only report a finding when it is tied to the diff and has a concrete impact.

Each finding should explain:

- where the issue is
- why the changed behavior is risky or wrong
- what impact it can have
- how to fix or verify it

State assumptions explicitly. Do not present speculation as fact. Do not add
positive observations unless the user asks for them.

## Severity

- `P0`: data loss, security incident, production outage, or severe corruption
- `P1`: clear functional regression, broken user-visible behavior, or compatibility break
- `P2`: edge-case bug, risky missing test, or maintainability risk
- `P3`: minor issue worth noting only when the user asks for a very detailed review

Default to reporting `P0` through `P2`. Include `P3` only when requested.

## Output Format

Lead with findings. Keep the summary short.

```md
## Findings

- [P1] Short title
  File: `/absolute/path/file.ts:123`
  Problem: ...
  Impact: ...
  Suggested fix: ...

## Open Questions

## Test Gaps

## Summary
```

If there are no findings, say:

```md
No findings.

Test gaps / residual risk:
...
```
