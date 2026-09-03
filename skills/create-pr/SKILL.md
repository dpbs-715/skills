---
name: create-pr
description: Create a GitHub pull request or GitLab merge request from existing local or remote branches with `gh` or `glab`. Use when the user invokes `/create-pr`, `$create-pr`, asks to open, submit, preview, draft, or create a PR or MR, or wants to push a development branch and open it for review. Create immediately by default, including a required normal source-branch push; preview only when the user asks. Support `<source> to <target>` and `to <target>` branch syntax. Do not use for creating development branches, changing or committing code, reviewing an existing PR/MR, or merging one.
compatibility: Requires Git and either GitHub CLI (`gh`) or GitLab CLI (`glab`) for the selected host.
---

# Create PR

Turn an existing development branch into a reviewable GitHub pull request or
GitLab merge request. Prefer explicit source, target, repository, and CLI
arguments so a request cannot silently point at the wrong remote or branch.

## Scope

Handle:

- resolving local and remote source and target branches;
- checking commits, diffs, templates, linked issues, and duplicate requests;
- safely pushing the source branch when creation requires it;
- drafting, previewing, and creating one GitHub PR or GitLab MR.

Do not create a development branch, edit or commit code, rebase, merge, resolve
conflicts, force-push, change repository settings, or merge the created PR/MR.
Do not update an existing PR/MR unless the user explicitly asks for that
separate action.

## Defaults

- Treat a skill invocation or a request to create, open, or submit a PR/MR as
  authorization to create it immediately, including a required normal push of
  the resolved source branch. Do not add a separate preview or confirmation step.
- If the user explicitly asks to preview, show the content first, write only the
  title/body, or approve before creation, show the final preview and wait without
  pushing or creating anything.
- A request to create a Draft PR/MR authorizes creating a remote request in Draft
  state. Distinguish this from a request to draft only the title/body.
- Ask only when material information, an ambiguous destination, conflicting
  existing requests, or unsafe Git state prevents proceeding. Infer routine
  details from repository evidence.

## Language

Use `-ch` to write the PR/MR title, authored body content, preview, and final
response in Chinese. Use `-en` to write them in English.

If neither flag is provided, use English even when the user's request is in
another language. Preserve repository-mandated template headings and checklist
text verbatim unless the user explicitly asks to translate them. Keep repository
names, remote names, branch names, labels, milestones, usernames, issue and
request identifiers, filenames, commands, code, logs, error messages, and URLs
unchanged.

## Command syntax

Interpret `to` as a directional separator: the source is on the left and the
target is on the right.

```text
/create-pr <source> to <target>
/create-pr to <target>
```

Apply the same parsing to `$create-pr` invocations.

Recognize `-ch` and `-en` anywhere in the invocation. Remove the language flag
before parsing source, `to`, and target, then apply it to the authored content
and response. For example, `/create-pr -ch A to C` and
`/create-pr A to C -ch` have the same branch direction.

### Explicit source

```text
/create-pr A to C
```

Create a PR/MR whose remote source branch is `A` and whose target branch is `C`.
`A` does not have to be the currently checked-out branch. Resolve whether `A`
already exists remotely before deciding that a push is needed.

### Current source

```text
/create-pr to C
```

Use the currently checked-out local branch and its upstream remote branch as the
source, with `C` as the target. For example, local branch `feature/orders`
tracking `origin/feature/orders` uses remote branch `feature/orders` as the
source.

If the current branch has no upstream, do not pretend one exists. Resolve an
unambiguous remote and use `git push --set-upstream <remote> <branch>` when
creation requires a push. For preview-only requests, describe the planned push
without executing it. If the remote is ambiguous, ask.

### Bare invocation and natural language

For `/create-pr` without `to`, use the current branch as the source and resolve
the repository's default branch as the target. Natural-language requests may
specify the same information without this compact syntax.

Treat source and target as branch refs, not shell fragments. Preserve case and
slashes, validate each with `git check-ref-format --branch`, and pass refs as
discrete arguments. The separator is the standalone token `to`; a `to` substring
inside a branch name is not a separator. Reject missing, invalid, or identical
source and target refs.

## Workflow

### 1. Resolve platform, repository, and remotes

Use evidence in this order:

1. An explicit host, repository, or PR/MR URL from the user.
2. Repository context already established in the conversation.
3. Git remotes associated with the resolved source and target branches.

Map GitHub, including GitHub Enterprise, to `gh`. Map GitLab.com and GitLab
Self-Managed to `glab`.

Do not pick `origin` merely because of its name. Inspect remote URLs, current
upstream configuration, and remote branch existence. When a fork has `origin`
and the canonical repository has `upstream`, distinguish the source repository
from the target repository. Ask before writing if more than one mapping remains
plausible.

Use explicit repository arguments for every platform command:

- GitHub: `--repo [HOST/]OWNER/REPO`
- GitLab: `--repo GROUP/PROJECT` or a full project URL

For cross-repository or fork requests, identify both repositories and confirm
that the installed CLI version can express the relationship. On GitHub, use an
owner-qualified head such as `fork-owner:A` when needed. Do not guess a GitLab
fork mapping; inspect `glab mr create --help` and stop if the installed version
cannot target it unambiguously.

### 2. Check prerequisites and authentication

Check Git and the selected platform CLI, then run its authentication status
command for the resolved host.

If a prerequisite is missing or unauthenticated:

- stop before pushing or creating anything;
- report the missing prerequisite and appropriate login command;
- do not install software, expose tokens, request tokens in chat, or silently
  fall back to a REST call.

Use normal `gh` and `glab` commands. Use `gh api`, `glab api`, or `curl` only when
the user explicitly requests an API path or approves a required CLI fallback.

### 3. Resolve branch refs

For an explicit source, look for these in order:

1. An exact local branch with a configured upstream, comparing its local and
   remote SHAs so unpushed commits remain visible.
2. An exact local branch that can be pushed to one unambiguous source remote.
3. An exact remote branch in the selected source repository when no local branch
   exists.

For an omitted source, require a named current branch; stop on detached HEAD.
Read its upstream with Git rather than assuming the local branch name and remote
name match.

Resolve the target only in the selected target repository. If no target is
specified, use the repository's actual default branch rather than assuming
`main` or `master`.

Fetch only the refs needed to compare source and target. Do not pull, merge, or
rebase. Verify that both remote refs exist and that the target is not the source.

### 4. Inspect local and remote state

Inspect:

- working tree status when the source has a local branch;
- local source versus its upstream: ahead, behind, or diverged;
- commits in `target..source`;
- changed files and relevant diff statistics;
- repository guidance such as `CONTRIBUTING.md` and `AGENTS.md`.

Uncommitted changes are not part of a PR/MR. Mention them in the result (or the
requested preview) and do not stage, commit, stash, discard, or otherwise include
them. If the request clearly expects those changes, stop and ask the user to
handle or authorize a commit workflow first.

If the local source is behind or diverged from its upstream, stop rather than
repairing history. If it is only ahead, perform a normal, non-force push in
step 9 for creation requests; describe it only for preview requests.
If source contains no commits or changes relative to target, do not
create an empty PR/MR.

### 5. Check for an existing PR or MR

Search the exact target repository and source branch before drafting a new
request:

```sh
gh pr list --repo OWNER/REPO --head <source>
glab mr list --repo GROUP/PROJECT --source-branch <source>
```

Qualify the GitHub head with its owner for fork requests when needed. If an open
PR/MR already has the same source and target, return its number, state, and URL
instead of creating a duplicate. If it targets a different branch, show the
existing request and ask before creating another one from the same source.

### 6. Gather template and issue context

Prefer a repository template:

- GitHub: `.github/PULL_REQUEST_TEMPLATE.md` or a matching file under
  `.github/PULL_REQUEST_TEMPLATE/`;
- GitLab: a matching file under `.gitlab/merge_request_templates/`.

Preserve required headings and checklists. Derive the title and body from the
actual commits and diff, not only from the branch name. If the branch name,
conversation, commits, or repository conventions identify a related issue,
inspect that issue before referencing it.

Use a closing keyword such as `Closes #123` only when merging this PR/MR should
complete that issue. Otherwise use a non-closing reference such as
`Related to #123`. Never invent issue links, test results, reviewers, risks, or
deployment evidence.

Without a repository template, use only relevant sections from:

```md
## Summary

## Changes

## Testing

## Related issue

## Notes
```

State `Not run` when tests are known not to have run. Do not claim a check passed
merely because the code looks correct.

### 7. Determine request metadata

Collect only requested or clearly established metadata:

- Draft or ready state;
- reviewers and assignees;
- labels and milestone;
- GitHub project or GitLab options supported by the installed CLI.

Validate named users, labels, milestones, and templates with read-only commands
where practical. Do not create missing metadata or quietly omit invalid values.
Do not mark incomplete work ready merely because the branch is pushable.

### 8. Preview or proceed

For creation requests, proceed directly to the required push and PR/MR creation
without preview confirmation.

Only when the user requests a preview or approval before creation, show:

- platform, host, and target repository;
- remote source repository and branch;
- `source -> target`;
- commits and changed-file summary;
- complete title and Markdown body;
- Draft or ready state and reviewed metadata;
- related or closing issue references;
- exact push required, if any;
- uncommitted local changes that will not be included.

For these preview-only requests, stop here without pushing or creating anything.
Once the user approves creation, continue without asking for the same approval
again.

### 9. Push the source when required

Push only the reviewed source ref to the reviewed source remote. Use a normal
push, adding upstream configuration only when it is missing:

```sh
git push <remote> <local-source>:<remote-source>
git push --set-upstream <remote> <local-source>
```

Never force-push. Do not push other branches or unrelated commits. After the
push, verify the remote source SHA matches the reviewed local source SHA before
creating the PR/MR.

### 10. Create through the official CLI

Write the final body to a temporary Markdown file to preserve formatting and
avoid shell-quoting problems. Pass every value as a discrete argument.

GitHub:

```sh
gh pr create --repo OWNER/REPO --head <source> --base <target> --title <title> --body-file <body-file>
```

Use an owner-qualified `--head` for a fork. Add `--draft` and reviewed metadata
flags only when applicable.

GitLab:

```sh
glab mr create --repo GROUP/PROJECT --source-branch <source> --target-branch <target> --title <title> --description-file <body-file> --yes
```

Add `--draft` and reviewed metadata flags only when applicable. Do not combine
an authored body with `--fill`, because implicit commit-derived content can
override or dilute the reviewed template.

Capture the returned number or IID and URL. If the push succeeds but request
creation fails, keep the remote branch and report the partial result. Do not
delete it, retry against another repository or target, or switch to a web/API
flow without approval.

## Result

After completion, report:

```md
Created <PR | MR> `<repo>#<number>`: <title>
URL: <request-url>
Branches: `<source>` -> `<target>`
State: <Draft | Ready>
Related issue: <reference | none>

Notes:
- <push performed, excluded local changes, omitted metadata, or partial failure>
```

If a matching request already exists, say that nothing new was created and
return its URL. Keep branch names, remotes, repository identifiers, commands,
and URLs unchanged when responding in the selected language.
