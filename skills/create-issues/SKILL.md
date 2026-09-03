---
name: create-issues
description: Create or draft high-quality GitHub or GitLab issues with the official `gh` or `glab` CLI. Use whenever the user asks to file, open, submit, preview, or batch-create issues from bugs, requirements, TODOs, logs, or review findings. Create immediately when requested, add suitable existing metadata, and create an associated branch by default; preview or omit the branch only when the user asks. Do not use for merely explaining or reviewing an existing issue.
compatibility: Requires Git and either GitHub CLI (`gh`) or GitLab CLI (`glab`) for the selected host.
---

# Create Issues

Turn unstructured work into a clear GitHub or GitLab issue. Keep the interaction
light: perform routine read-only checks silently, make safe inferences from the
repository, and interrupt only for a decision that materially affects the result.

## Defaults

- Write issue titles, authored body content, previews, and results in English.
  Use Chinese with `-ch` and English with `-en`; treat either flag as an option,
  not issue content.
- Treat “create,” “file,” “open,” or “submit” as authorization to create the
  issue immediately. Do not add a separate preview or confirmation step.
- If the user asks to “draft,” “preview,” “show me first,” or approve before
  creation, show the final draft and wait without making external changes.
- Assign the issue to the authenticated CLI account that creates it by default.
  Honor an explicit request for another assignee or for no assignee instead.
- After creating an issue, create and check out an associated branch by default.
  Skip it only when the user asks for no branch or only an issue.
- Ask one consolidated question only when blocked by an ambiguous destination,
  a high-confidence duplicate, missing material facts, or an unsafe branch
  operation. Do not ask about details that can be inferred or safely omitted.

Preserve repository-mandated template text unless translation was requested.
Keep identifiers, paths, commands, code, logs, error messages, and URLs unchanged.

## Workflow

### 1. Resolve the destination

Resolve the platform and repository from, in order:

1. an explicit host and repository;
2. a supplied repository URL;
3. the current repository's matching Git remote.

Use GitHub CLI for GitHub and GitLab CLI for GitLab. Always pass an explicit
repository argument:

```sh
gh ... --repo [HOST/]OWNER/REPO
glab ... --repo GROUP/PROJECT
```

Inspect remotes rather than choosing whichever CLI is installed. If multiple
remotes leave the issue destination or development remote genuinely ambiguous,
ask before any write.

For creation, check Git, the selected CLI, and authentication for the resolved
host. If a prerequisite is missing, stop and provide the relevant login command.
For preview-only work, missing authentication does not block drafting; identify
any metadata that could not be validated. Do not install software, request
tokens in chat, or silently fall back to an API.

### 2. Gather only useful context

Read relevant repository guidance, issue templates, labeling conventions, and
the evidence named by the user. Prefer a matching template and preserve its
required headings. Never invent versions, reproduction results, owners,
deadlines, or acceptance criteria.

Choose a concise, searchable title and a body containing only useful sections.
Separate facts from inference, redact secrets, fence relevant logs, and use
repository-relative paths when collaborators need to resolve them.

Select the smallest confident set of existing labels unless the user opts out.
Validate requested metadata where practical. Never create labels, milestones,
or other repository configuration implicitly. If nonessential requested
metadata does not exist, omit it, continue, and mention the omission in the
result; ask only when that field is central to the request.

Unless the user overrides the default, set the assignee to the account
authenticated against the resolved destination host. Use GitHub's `@me`
shortcut. For GitLab, resolve the authenticated account's username for that
host and pass it explicitly; do not infer it from the local Git author.

### 3. Check duplicates

Search open and closed issues in the exact destination using distinctive title
terms, error identifiers, and component names:

```sh
gh issue list --repo OWNER/REPO --state all --search "<terms>"
glab issue list --repo GROUP/PROJECT --all --search "<terms>"
```

Pause only for a high-confidence duplicate describing the same underlying work;
show its number, title, state, and URL. Weak keyword matches and merely related
issues do not block creation.

### 4. Draft or create

For preview-only requests, show the destination, complete title and body,
metadata, and planned branch, then wait.

For creation requests, proceed without preview confirmation. Write the body to
a temporary Markdown file to preserve formatting and avoid quoting problems:

```sh
gh issue create --repo OWNER/REPO --title "<title>" --body-file <body-file> --assignee "@me"
glab issue create --repo GROUP/PROJECT --title "<title>" --description-file <body-file> --assignee "<authenticated-username>" --yes
```

Pass arguments discretely; do not build an `eval` string. Include every selected
metadata field supported by the CLI and capture the issue number or IID and URL.

For a batch, create issues in the requested order. If one fails, stop unless the
user explicitly allowed partial continuation. Report successes and failures;
never delete successful issues as an automatic rollback.

## Associated branch

Unless the user opted out, create the branch immediately after the issue. Before
creating the issue, confirm that the local repository matches it, resolve the
remote default branch, and inspect the working tree. After the issue number is
known, check that the proposed branch does not already exist. Never stash,
discard, reset, overwrite, or force-push user work.

Follow a documented repository convention, subject to the GitLab rule below. Otherwise use:

```text
<issue-number>-<type>-<short-description>
```

Examples: `123-fix-login-timeout`, `124-feat-export-orders`.
GitLab branches must start with `<IID>-` and contain no `/` (e.g. `22-fix-login`,
not `any/22-fix-login`) so GitLab can associate them with issues.

For GitHub, use the native linked-branch command:

```sh
gh issue develop <number> --repo OWNER/REPO --base <base> --name <branch> --checkout
```

Use `--branch-repo` when development happens in an approved fork.

For GitLab, create the branch from the resolved remote base and push it to the
same project:

```sh
git fetch <remote> <base>
git switch --create <branch> <remote>/<base>
git push --set-upstream <remote> <branch>
```

If uncommitted work would be carried to or conflict with the new branch, ask
whether to create it without checkout or let the user handle the changes first.
Do not push to an upstream project when development belongs in a fork.

For a batch, use non-checkout branch operations so every associated branch is
created without repeatedly changing the working tree. Check out a branch only
when the user identifies which issue to start. If branch creation fails after
issue creation, preserve the issue and report the exact failed step.

## Result

Keep the response compact:

```md
Created issue `<repo>#<number>`: <title>
URL: <issue-url>
Branch: `<branch>` from `<base>` (<created and checked out | created remotely | skipped | failed>)

Notes:
- <duplicate check, omitted metadata, partial failure, or other relevant detail>
```

For a batch, return one entry per issue and clearly associate each branch with
its issue. Omit `Notes` when there is nothing useful to add.
