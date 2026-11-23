# Maintainer notes

Maintainer-only background for `zentao-bug-list`. Runtime instructions never
load this file; keep agent-facing rules in `SKILL.md` and `query.md`.

## Evidence for the `assignedTo` compatibility rule in query.md

- [Official CLI documentation](https://github.com/easysoft/zentao-cli/blob/main/docs/cli-usage.md#api-覆盖与版本兼容)
  documents the corrected case-sensitive `assignedTo` browse value in newer SDKs.
- Verified on 2026-10-16 with CLI 0.3.0 and ZenTao 22.6: two reads with the same
  profile and projection returned 7 assigned rows for `assignedTo` and 0 for
  `assignedtome`. This explains that failure without attributing it to version,
  permissions, or missing user data.
