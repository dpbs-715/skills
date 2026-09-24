# Local Setup Prompt

Send the code block below to a coding agent with local terminal, filesystem, and network access. The prompt includes the repository URL and can be forwarded on its own. No skills from this repository need to be installed beforehand.

This configuration includes the author's engineering preferences, workflows, and roles. The default linking process handles multiple existing tool directories and may merge OpenCode configuration. Keep the repository in a permanent location; do not delete or move it after installation.

```text
Install https://github.com/dpbs-715/skills.git on my machine and verify the installation. Carry out the setup rather than only giving me commands.

Use ~/agent-skills unless I specify another location. You are authorized to download the repository, install its required project dependencies, and register skills, rules, and agents for tools already configured on this machine, following the repository configuration. First identify the current agent and runtime environment; ask me if you cannot determine the target tool.

Setup requirements:

1. Check the operating system, Git, Node.js, and pnpm. After cloning, read AGENTS.md, README.md, package.json, meta.ts, and the relevant setup scripts. Treat the checked-out version as authoritative. Use the Node and pnpm versions declared in package.json, preferably through an existing version manager. For missing tools, prefer installation for the current user through an existing package manager; do not replace my system's default runtime. Explain any permission or environment blockers. On native Windows, check path handling and symlink support in both the scripts and the target agent. If WSL is needed, confirm that the agent runs in the same environment.

2. Clone normally if the destination does not exist. If it already exists, verify that it belongs to this repository and inspect the working tree. Preserve local changes; do not use reset --hard or force overwrites. Update an existing checkout only when it is clean and can be fast-forwarded. If the directory belongs to something else, use a new directory or ask me to choose.

3. Inspect linkTargets in meta.ts, list the tool directories and configuration files that this setup will write to, and proceed. The normal link command handles multiple existing tool directories; do not describe it as installing only into the current tool. Create any missing skills directory required by the target tool, but do not create directories for unused tools. Determine the Codex user skills location from the current environment and avoid creating two locations that cause duplicate discovery. Do not treat link --target as a complete installation of agents, rules, and configuration merges.

4. Preserve skills, agents, and rules from other sources. Back up existing configuration files before modifying them. Inspect OpenCode merge entries such as instructions and permission.external_directory; if they conflict with existing explicit settings, explain the differences and let me choose. Do not delete files with matching names to bypass link conflicts, and do not edit generated/ by hand.

5. Run the following sequence from the repository directory, proceeding only after each step succeeds. If the repository implementation has changed, adapt the sequence to its actual documentation and scripts:
   pnpm install --frozen-lockfile
   pnpm skills init
   pnpm skills sync
   pnpm skills note reindex
   pnpm skills link
   pnpm skills status
   pnpm skills validate

   Note: sync updates vendor submodules and copies their content; it does not simply use the submodule commits pinned by the main repository. Record the final main repository and submodule revisions. knowledge/INDEX.md and knowledge/notes/ are private local content. A fresh installation must run note reindex to create its own index before running link. Do not copy the author's private notes or credentials.

6. Inspect skipped entries, conflicts, and errors in the link output and explain each one. Confirm that the target tool directories contain valid links to this repository, that repository paths in generated files point to my actual installation, and that the team-workflow skill, ui-designer role source files, and its role-only skills are readable. Do not declare success solely because the commands exited successfully. Role-only skills are intentionally absent from the global skill list.

7. Verify skill discovery and role loading using capabilities actually supported by the current tool. Codex uses team-workflow to pass repository roles to generic subagents. Role files for Claude Code, Kimi Code, OpenCode, and Pi are generated according to the repository configuration. Pi also needs a subagent extension that can load those role files. If verification requires a new session or restart, clearly distinguish files being installed from runtime behavior still awaiting verification, and tell me what to do next.

Finish with a brief installation report: repository path and revision, tools actually configured, installation results for skills/rules/agents, verification results, conflicts or skipped entries, and whether I need to reopen the session. Include two usable example prompts. One should ask team-workflow to coordinate a UI designer and a frontend engineer, then report the role and work performed by each subagent. There is no need to create an application project, commit code, or push anything to verify this installation.
```

This prompt does not bypass the receiving agent's permission requirements. Whether newly installed skills or subagents are immediately available depends on the receiving tool's loading behavior and capabilities.
