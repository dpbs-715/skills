# Agent Routing

Before substantive work, assess whether the task needs a repository role's
specialist judgment or methods, even when the user has not named a role. For
such work, read the [role index](../../generated/agents/INDEX.md), select only
roles whose descriptions match the actual task, and load their configuration
before using them. Skip role loading for trivial edits and unrelated work.
Reuse an index already read in this session unless role sources change.

## Avoid Repeated Loading

Within each agent, track configuration currently being read and configuration
already loaded. Mark an entry as being read before following its relevant
references. When a reference points to an entry in either set, reuse the
available instructions and stop following that edge. Treat symlinks and source
or generated copies of the same role, rule, or skill as one logical entry;
another path is not a reason to load it again.

Links provide context; they do not restart role selection or the task workflow.
Reassess roles only when task scope changes or actual work reveals a new
specialist need. Reload relevant configuration when it changes, or when its
contents are unavailable after context compaction. A child agent needs its own
configuration unless the actual contents are present in its context; the
parent's loaded list alone is insufficient.

## Choose How to Apply a Role

- For a small or tightly coupled task, load the relevant role and apply its
  methods in the main chat. The user's task is the assignment; retain the lead
  agent's responsibility for implementation, integration, and verification.
- For a bounded specialist task with a clear output and check, delegate when
  independent judgment, context isolation, or parallel work would materially
  help. This rule explicitly requests that delegation without requiring the
  user to name a role or ask for multiple agents each time. Load
  [team-workflow](../../generated/team-workflow/SKILL.md) before delegating;
  it owns role binding, dependencies, result collection, and verification.
- Use the smallest useful set of roles. Do not turn every task into a team
  workflow. Respect a user's request to work directly or avoid subagents; the
  main agent can still load relevant specialist methods.
- Subagents should perform their assigned role and task, without repeating
  team selection or creating further agents unless their assignment requires it.
  If delegation tools are unavailable, apply the role directly and report that
  execution mode accurately. Role files do not create native host capabilities.

## Load the Selected Configuration

Read both the selected role's `AGENT.md` and `agent.json` from the index. Resolve
the manifest's `rules` paths against `{{REPO_ROOT}}`, read their entry documents,
and follow their relevant topic links. For names in `skills` and
`agentOnlySkills`, read the relevant `SKILL.md` under
`{{REPO_ROOT}}/generated/`, in the directory named after that skill. Do not load
every listed skill merely because it is configured. Agent-only skills remain available by path without
being installed in the general skill list.

Keep the role's responsibility within the user's task and follow applicable
project instructions and explicit-only skill triggers. Selection does not
authorize additional repository operations or external actions. If a required
file is unavailable, report the specific missing configuration and use an
available fallback without claiming that role capability was loaded.

Briefly state the role, execution mode, and relevant skills actually loaded when
they affect how the task is handled. A role name or index entry alone is not
evidence that the role's instructions or skills were used. Direct application
does not need a subagent completion table.
