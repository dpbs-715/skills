---
name: team-workflow
description: Use when the user explicitly asks to organize, delegate, or run work with multiple agents or a team workflow. Select roles from this repository's agents directory, coordinate parallel or sequential tasks, collect results, and verify the combined deliverable.
---

# Team Workflow

Use this skill as the entry point for work the user wants handled by multiple agents. Build an ad hoc team for the current task using roles from `{{REPO_ROOT}}/agents/`. This skill owns task coordination; each role owns its specialist instructions.

1. Start from the user's concrete task and build the smallest useful task plan. Select roles and dependencies for this run. Keep the plan in the current task; save a reusable template under `{{REPO_ROOT}}/teams/` only when the user asks.
2. Inspect the selected roles under `{{REPO_ROOT}}/agents/`, reading their agent.json and AGENT.md. If no role fits a needed task, use a general agent with a clearly scoped assignment instead of inventing a specialist.
3. Record prerequisites for each task. Start a dependent task after the lead agent has checked and accepted its prerequisite outputs. Independent ready tasks may run concurrently within the host's limits.
4. For every delegated task, specify its objective, relevant context, owned files or subject area, expected output, and validation. Bind its role configuration using the instructions below. Track the returned subagent identifier or task name together with the assigned role and task.
5. Avoid assigning overlapping edits to the same files. When isolation is available and useful, give coding agents separate worktrees or branches. Keep the final integration with the coordinating agent.
6. Collect each result with the role used, skills actually used, evidence, changed files, unresolved questions, and verification. Resolve conflicting findings against sources and tests, then verify the assembled result. When the user changes scope, update affected assignments and check their results against the latest scope before accepting them.
7. Report the final outcome and include the completion report below. Identify work that could not be completed and why.

## Role configuration

- When the host supports selecting an installed native role, select that role explicitly. A task label such as "UI designer" does not load a role by itself.
- For a generic subagent, include the absolute paths to the chosen role's `AGENT.md` and `agent.json` in its assignment and require it to read both before work. Resolve the manifest's `rules` paths relative to `{{REPO_ROOT}}`; for `skills` and `agentOnlySkills`, use each skill name as a directory under `{{REPO_ROOT}}/generated/` and read its `SKILL.md`. Pass these resolved paths and require the subagent to follow the rules and read the skills relevant to its task. Do not assume it inherits the lead agent's context. If the host cannot access these files, provide the relevant instructions in its assignment; report any required configuration that remains unavailable.
- Ask the subagent to identify the role and skills it actually used in its result. Check this against the assignment before crediting a repository role in the report. A general agent with no repository role must be reported as such.

## Completion report

After the overall result, include a compact table in the user's language with one row per subagent task:

| Subagent / task | Repository role | Work completed | Deliverables and verification | Status |
| --- | --- | --- | --- | --- |

Use the actual task name or a short unambiguous identifier, the manifest's role name, and links to deliverables when available. Include skills actually used when they help explain the contribution; a configured skill list is not evidence of use. Report failed, blocked, cancelled, or unverified work accurately. Briefly describe the lead agent's integration and final verification after the table. If no subagents ran, say the lead agent completed the work directly and omit the table.

If the user invokes this skill without a task, ask for the task before delegating. Do not spawn agents for tasks that have no meaningful independent parts. Do not treat a role's skill list as a runtime security boundary: some hosts expose other installed skills to every agent. Follow explicit user instructions even when they differ from a role's default skill list.
