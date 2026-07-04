---
name: mock
description: Trigger when the user types a command starting with /mock, or asks to simulate a request/call flow. Treat the request as a code-change task, list the currently available tools, skills, and rules, and use tables to show which ones would be invoked and why.
---

# Mock Request Simulation

When the user enters `/mock <task>` or asks to simulate a request, follow this workflow.

## Task Interpretation

Treat `<task>` as a user request that is preparing to modify code. If no task is provided, default to "prepare to change code".

Do not actually modify any files or execute code. Only read project instruction files as needed to list referenced docs, and only output the simulated plan.

## Language

Use `-ch` to respond in Chinese. Use `-en` to respond in English.

If neither flag is provided, respond in the user's language. Keep tool names, skill names, rule names, and file paths unchanged.

## Inventory Sources

Read the following lists and files from the current system context:

- `available_tools`: the currently available tools
- `available_skills`: the currently available skills
- `available_rules`: the currently active rules
- Project instruction files: `AGENTS.md`, `CLAUDE.md` and other project-level docs loaded by the active agent
- Documents referenced or imported by `AGENTS.md` and `CLAUDE.md` (for example, topic files linked under `rules/` or `topics/`, global rules mentioned in `AGENTS.md`, etc.)

Only recursively list referenced docs for `AGENTS.md` and `CLAUDE.md`. For other instruction files, just note whether they are present and loaded.

## Output Format

Output four Markdown tables.

### Tools

| Name | Would invoke | Reason |
|------|--------------|--------|
| ...  | Yes / No     | ...    |

### Skills

| Name | Would invoke | Reason |
|------|--------------|--------|
| ...  | Yes / No     | ...    |

### Rules

| Name | Would invoke | Reason |
|------|--------------|--------|
| ...  | Yes / No     | ...    |

### Project Instructions / Agent Context

Common project-level instruction files. For `AGENTS.md` and `CLAUDE.md`, read them if present and list the documents they reference or import. For other files, only mark presence and whether the current agent loads them.

| Source | Present | Loaded by current agent | Included / Referenced docs | Reason |
|--------|---------|-------------------------|----------------------------|--------|
| `AGENTS.md` | Yes / No | Yes / No | `...` | opencode default; recurse into references |
| `CLAUDE.md` | Yes / No | Yes / No | `...` | Claude Code default; recurse into references |

## Invocation Rules

- Only mark items directly relevant to the task.
- For items that depend on context, mark "Maybe" and explain the condition.
- Keep it concise. Focus on what would be invoked, what would definitely not be invoked, and why.
