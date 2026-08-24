---
name: create-issues
description: Create high-quality GitHub or GitLab issues with the official `gh` or `glab` CLI, including duplicate checks, repository templates, metadata, preview, and optional linked branch creation. Use whenever the user asks to file, open, submit, draft and post, or batch-create issues; turn bugs, feature requests, TODOs, logs, review findings, or requirements into repository issues; or create an issue and start a branch. Do not use for merely explaining issues or reviewing an existing issue without creating one.
compatibility: Requires Git and either GitHub CLI (`gh`) or GitLab CLI (`glab`) for the selected host.
---

# Create Issues

Turn unstructured work into a clear GitHub or GitLab issue and, when requested,
start an associated development branch. Prefer the platform's official CLI so
authentication, enterprise hosts, and repository selection use the user's
existing configuration.

## Scope

Handle:

- issue drafting, duplicate search, metadata validation, preview, and creation;
- one issue or an explicitly reviewed batch;
- optional linked branch creation after an issue exists.

Do not silently expand the task to editing, closing, deleting, or commenting on
existing issues; creating labels or milestones; opening pull or merge requests;
or changing repository settings. Perform those actions only when the user asks
for them and the applicable workflow is understood.

## Workflow

### 1. Resolve the platform and repository

Use evidence in this order:

1. An explicit GitHub or GitLab host and repository from the user.
2. A repository URL supplied by the user.
3. The current repository's matching Git remote.

Inspect remotes without changing them. Do not choose a destination merely
because `gh` or `glab` happens to be installed. If the host, repository, or
remote remains ambiguous, ask before creating anything.

Map the platform to its CLI:

- GitHub, including GitHub Enterprise: `gh`
- GitLab.com or GitLab Self-Managed: `glab`

Use explicit repository arguments even when a current repository exists:

- GitHub: `--repo [HOST/]OWNER/REPO`
- GitLab: `--repo GROUP/PROJECT` or a full project URL

This makes the destination visible and avoids creating an issue in the wrong
remote when a repository has forks or multiple remotes.

### 2. Check prerequisites and authentication

Check that Git and the selected platform CLI are available. Then run the CLI's
authentication status command for the selected host.

If the CLI is missing or unauthenticated:

- stop before any external write;
- report the missing prerequisite and the relevant login command;
- do not install software, print tokens, request a token in chat, or silently
  fall back to direct REST calls.

Use `gh` or `glab` commands directly. Use `gh api`, `glab api`, `curl`, or another
API path only when the user explicitly requests an API-based workflow or the
requested capability is unavailable in the normal CLI and the user approves
that fallback.

### 3. Gather repository context

Read only the context needed to draft the issue:

- repository guidance such as `CONTRIBUTING.md` or `AGENTS.md`;
- GitHub templates under `.github/ISSUE_TEMPLATE/`;
- GitLab templates under `.gitlab/issue_templates/`;
- relevant logs, TODOs, review findings, requirements, or code referenced by
  the user.

Prefer a matching repository template. Preserve its headings and required
fields, filling them with known facts. Mark genuinely unknown required facts as
unknown or ask when the missing value materially changes the issue; never invent
versions, reproduction results, owners, deadlines, or acceptance criteria.

### 4. Draft the issue

Choose a concise, searchable title that states the observable problem or desired
outcome. Do not merely copy a vague user sentence.

Use only sections that help the issue. A typical bug draft is:

```md
## Summary

## Steps to reproduce

## Expected behavior

## Actual behavior

## Environment

## Additional context
```

A typical feature or task draft is:

```md
## Context

## Desired outcome

## Acceptance criteria

- [ ] ...

## Notes
```

Keep facts separate from inference. Include logs and error excerpts only when
they are relevant, redact secrets, and use fenced code blocks for terminal
output. Reference local paths only when repository collaborators can resolve
them; otherwise summarize the evidence or use repository-relative paths.

Collect only supported metadata:

- common: labels, assignees, milestone, template;
- GitHub-specific: project, issue type, parent or blocking relationships;
- GitLab-specific: confidential, due date, weight, epic, time estimate, or
  linked issues.

Check requested labels, assignees, milestones, and templates with read-only CLI
commands where practical. If a requested value does not exist, report it rather
than creating a replacement or quietly dropping it.

### 5. Search for duplicates

Build a short query from the title's distinctive nouns, error identifiers, and
component names. Search open and closed issues in the exact destination:

```sh
gh issue list --repo OWNER/REPO --state all --search "<terms>"
glab issue list --repo GROUP/PROJECT --all --search "<terms>"
```

For enterprise or self-managed hosts, retain the resolved host in the repository
argument or CLI context. If a result appears to describe the same underlying
work, show its number, title, state, and URL and ask whether to use the existing
issue. Similar keywords alone are not proof of duplication.

### 6. Preview before creating

Show a compact final preview containing:

- platform, host, and repository;
- issue title and complete Markdown body;
- labels, assignees, milestone, and platform-specific fields;
- whether a linked branch will be created, its base, name, remote, and whether
  it will be checked out;
- all issue titles and the total count for a batch.

Obtain confirmation for this preview before the first external write. A prior
general request to discuss or draft an issue is not creation approval. If the
user already supplied an exact approved preview and explicitly said to create
it, do not ask them to approve the same content again.

### 7. Create through the official CLI

Write the final body to a temporary Markdown file and pass the file to the CLI.
This preserves Markdown and avoids shell quoting problems.

GitHub:

```sh
gh issue create --repo OWNER/REPO --title "<title>" --body-file <body-file>
```

GitLab:

```sh
glab issue create --repo GROUP/PROJECT --title "<title>" --description-file <body-file> --yes
```

Add only reviewed metadata flags. Pass arguments as discrete command arguments;
do not construct an `eval` string. `--yes` suppresses `glab`'s redundant CLI
prompt only after the skill's preview has been approved.

Capture the returned issue number or IID and URL. For a batch, create issues in
the reviewed order and record each result. If any creation fails, stop unless
continuing was explicitly approved, then report exactly which items succeeded
and which failed. Never delete successful issues as an automatic rollback.

### 8. Optionally create an associated branch

Create a branch only when the user requested one, or when they accept an offer
made after issue creation. Do not create branches for every issue by default.

Before changing Git state:

- confirm the local repository corresponds to the issue repository;
- inspect the working tree and current branch;
- resolve the base branch instead of assuming `main`;
- check for an existing local or remote branch with the proposed name;
- never stash, discard, reset, overwrite, or force-push user work.

If checkout would interfere with uncommitted changes, stop and ask whether the
user wants the branch created without checkout or wants to handle the changes
first.

Use a lowercase, shell-safe slug. Prefer this cross-platform name unless the
repository has a documented convention:

```text
<issue-number>-<type>-<short-description>
```

Examples: `123-fix-login-timeout`, `124-feat-export-orders`. For GitLab, the
issue IID followed immediately by `-` is important because GitLab uses that
prefix to associate the branch with the issue. A convention such as
`fix/123-login-timeout` can prevent that automatic association.

For GitHub, use its native linked-branch command:

```sh
gh issue develop <number> --repo OWNER/REPO --base <base> --name <branch>
```

Add `--checkout` only when the reviewed plan says to switch the local working
tree. Use `--branch-repo` when the approved development repository is a fork.

The current `glab issue` command has no equivalent linked-branch subcommand. For
GitLab, create the reviewed branch from the resolved remote base with normal Git
commands and push it to the same project:

```sh
git fetch <remote> <base>
git switch --create <branch> <remote>/<base>
git push --set-upstream <remote> <branch>
```

Do not push to an upstream project when the user only has or intends to use a
fork. If the branch exists, do not overwrite it; report it and offer to use it
only after verifying that it belongs to the same issue.

If issue creation succeeds but branch creation fails, preserve the issue and
report the partial result plus the exact failed step. Do not close the issue or
retry with a different base, remote, or branch name without approval.

## Result

After completion, report:

```md
Created issue `<repo>#<number>`: <title>
URL: <issue-url>
Branch: `<branch>` from `<base>` (<created and checked out | created remotely | not requested | failed>)

Notes:
- <duplicate check, omitted metadata, partial failure, or other relevant detail>
```

For a batch, return one line per issue and clearly associate each branch with
its issue. Keep commands, repository names, issue identifiers, URLs, and branch
names unchanged when responding in the user's language.
