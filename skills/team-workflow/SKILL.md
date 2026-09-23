---
name: team-workflow
description: Use when the user explicitly asks to organize, delegate, or run work with multiple agents or a team workflow. Select roles from this repository's agents directory, coordinate parallel or sequential tasks, collect results, and verify the combined deliverable.
---

# Team Workflow

Use this skill as the entry point for work the user wants handled by multiple agents. Reusable roles are in `{{REPO_ROOT}}/agents/`; reusable team templates may be stored in `{{REPO_ROOT}}/teams/`. This skill owns task coordination, not the roles' specialist instructions.

1. Start from the user's concrete task and build the smallest useful task plan. Select roles and dependencies for this run; no saved team template is required. If a vetted template under `{{REPO_ROOT}}/teams/` fits, read its team.json and TEAM.md and adapt it to the task.
2. Inspect the selected roles under `{{REPO_ROOT}}/agents/`, reading their agent.json and AGENT.md. If no role fits a needed task, use a general agent with a clearly scoped assignment instead of inventing a specialist.
3. Treat each task's `dependsOn` list as its prerequisites. Tasks with all prerequisites complete are ready; ready tasks may run concurrently if independent and the host permits. A chain is linear, tasks with no dependency between them are parallel, and one template may mix both. Never start a task before its prerequisites are checked.
4. For every delegated task, specify its objective, relevant context, owned files or subject area, expected output, and validation. Use the host tool's native agent mechanism when available. Respect the host's actual concurrency and permission limits.
5. Avoid assigning overlapping edits to the same files. When isolation is available and useful, give coding agents separate worktrees or branches. Keep the final integration with the coordinating agent.
6. Collect each result with evidence, changed files, unresolved questions, and verification. Resolve conflicting findings against sources and tests, then verify the assembled result.
7. Report the final outcome as one coherent answer. Identify work that could not be completed and why.

If the user invokes this skill without a task, ask for the task before delegating. Do not save an ad hoc plan as a team template; record a reusable workflow only when the user asks. Do not spawn agents for tasks that have no meaningful independent parts. Do not treat a role's skill list as a runtime security boundary: some hosts expose other installed skills to every agent. Follow explicit user instructions even when they differ from a role's default skill list.
