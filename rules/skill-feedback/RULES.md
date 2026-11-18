# Skill Feedback

When a skill, rule, or role maintained by this repository causes a reproducible
problem, record it locally even if a workaround let the original task succeed.
Collect feedback in a trusted personal checkout only. Do not record ordinary
business failures or publish feedback externally. If local writes are
prohibited, summarize the finding in the task response only.

1. Read the maintained source and reproduce the problem with an isolated
   fixture or a read-only check. For a missing reference, use the maintained
   file that contains it. Make clear what was reproduced locally; do not claim
   it affects upstream unless verified independently.
2. Pass one JSON report to the local command. Use `--input -` to read standard
   input, or `--input <json-file>` to read an existing private file.

   ```bash
   node "{{REPO_ROOT}}/scripts/skills.ts" feedback report --input -
   ```

   | Field | Content |
   | --- | --- |
   | `component`, `source` | Maintained component name and repository-relative source file |
   | `title`, `impact` | Observable failure and its effect on the task |
   | `operation`, `failure` | Stable one-line command or instruction name and error code or message |
   | `steps`, `cause`, `recommendation` | Expected and actual result, cause or hypothesis, and suggested fix with a check |
   | `sourceDigest` | Optional SHA-256 of the source used for reproduction |

   Use placeholders. Leave out business code, account or repo names, URLs,
   credentials, absolute paths, and raw output. The command does not redact the
   report. If the evidence cannot be described safely, summarize it in the
   original task only.
3. Continue the original task and return the saved or existing report path.
   If collection is disabled or saving fails, summarize the finding in the
   task response. Do not enable collection on the
   user's behalf, create an Issue, or retry through a different storage path.
