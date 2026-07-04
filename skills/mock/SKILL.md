---
name: mock
description: Trigger when the user types a command starting with /mock, or asks to simulate a request/call flow. Treat the request as a code-change task, list the currently available tools, skills, and rules, and use tables to show which ones would be invoked and why.
---

# Mock Request Simulation

When the user enters `/mock <task>` or asks to simulate a request, follow this workflow.

## Task Interpretation

Treat `<task>` as a user request that is preparing to modify code. If no task is provided, default to "prepare to change code".

Do not actually invoke any tools or modify any files. Only output the simulated plan.

## Language

Use `-ch` to respond in Chinese. Use `-en` to respond in English.

If neither flag is provided, respond in the user's language. Keep tool names, skill names, rule names, and file paths unchanged.

## Inventory Sources

Read the following lists and files from the current system context:

- `available_tools`: the currently available tools
- `available_skills`: the currently available skills
- `available_rules`: the currently active rules
- `AGENTS.md` / project instructions: project-specific notes and conventions loaded by the active agent (opencode reads `AGENTS.md`, Claude Code reads `CLAUDE.md`, Cursor reads `.cursorrules`, GitHub Copilot reads `copilot-instructions.md`, etc.)

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

Common project-level instruction files. Mark which ones are present and which ones the current agent actually loads.

| Source | Present | Loaded by current agent | Reason |
|--------|---------|-------------------------|--------|
| `AGENTS.md` | Yes / No | Yes / No | opencode default |
| `CLAUDE.md` | Yes / No | Yes / No | Claude Code default |
| Other project docs (README, CONTRIBUTING, etc.) | Yes / No | Maybe | Read on demand for context |

## Invocation Rules

- Only mark items directly relevant to the task.
- For items that depend on context, mark "Maybe" and explain the condition.
- Keep it concise. Focus on what would be invoked, what would definitely not be invoked, and why.
