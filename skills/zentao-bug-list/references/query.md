# Query execution

Resolve the binding, login, and requested filters in `../SKILL.md` first. All
commands below run through the shared connection helper. Replace placeholders
with verified values using safely quoted arguments or a process argument array.

## Choose one entry point

| Requested assignee | Entry point |
| --- | --- |
| Selected login account | Try the personal list below |
| Another account or all assignees | Use the scoped list directly |

### Personal list

```sh
node <connection-script> run --root '<repository>' --profile '<exact-key>' -- \
  my bugs --browseType=assignedTo --orderBy=id_asc \
  --page=1 --recPerPage=200 \
  --pick=id,title,severity,pri,status,assignedTo,openedDate,product,project
```

`assignedTo` is case-sensitive. CLI 0.3.0 help incorrectly advertises
`assignedtome`; on a verified ZenTao 22.6 deployment that value returned zero
rows, while `assignedTo` returned the assigned Bugs for the same account.
Use `assignedTo` even with that stale help. The personal endpoint is
`/api.php/v2/my/bugs`; its browse values are not interchangeable with those of
the product/project Bug endpoint.

The personal list spans the account's accessible scope. Keep `product` and
`project` in the response and apply the repository scope during aggregation.
Inspect raw non-empty rows for the bound scope field and `assignedTo`; if these
cannot be matched reliably, restart through the scoped list. Do not issue the
rest of the personal pages after deciding to fall back.

If keyword matching is requested, also include `steps` in `--pick`. Keep it for
filtering only, not display. If projection hides fields needed to interpret the
response, inspect the list without `--pick` through the same helper.

### Scoped list

```sh
node <connection-script> run --root '<repository>' --profile '<exact-key>' -- \
  bug --project=<project-id> --orderBy=id_asc \
  --page=1 --recPerPage=1000 \
  --pick=id,title,severity,pri,status,assignedTo,openedDate,product,project
```

Only for an explicit whole-bound-product request, replace `--project=<project-id>`
with `--product=<product-id>`. Add `steps` when keyword matching is requested.
Apply the requested assignee and other filters after aggregation. The endpoint
supplies the selected scope. In whole-product mode, keep other projects in the
results and use the returned project field for repository scope labels; in
default mode, match the bound project on personal-list rows. A product binding
alone never broadens the default project query.

Do not rely on this endpoint's `browseType` to mean assigned to the current
login. Some deployed project endpoints ignore it. Matching `assignedTo` from
the returned rows gives the same requested result without depending on that
shortcut.

## Compatibility and fallback

Use `my bugs --help` or `bug --help` through the helper when command support or
response fields are uncertain. Do not assume a `bug list` or `props` subcommand;
the supported scoped command in CLI 0.2.0/0.3.0 is `bug --product=…` or
`bug --project=…`.

The personal entry was added in CLI 0.3.0 and requires server 22.5 / biz13.5 /
max8.5 / ipd5.5 or newer. Let the actual business read establish support:

| Observation | Action |
| --- | --- |
| CLI does not recognize `my bugs`, or API reports unsupported version/route (such as `E2010`) | Restart with the scoped list for this invocation |
| Non-empty personal rows lack usable scope/assignee fields | Inspect the response shape; use the scoped list if unverifiable |
| Successful personal response has zero rows | Report empty under the requested scope; do not declare the API broken |
| Same-account, same-scope evidence contradicts an empty personal result | Verify the exact `assignedTo` browse value, then compare the scoped list; explain only what the evidence establishes |
| Authentication, permission, network, or config failure | Handle the actual error; do not mask it by changing entry points or accounts |

`zentao version` may report server information cached in the login profile. Do
not use it as a live upgrade check or a reason to skip a supported business
read. If versions are needed for diagnosis, compare only within the same
edition series; do not infer when or why an upgrade occurred.

There is no automatic retry through many browse values. If the installed CLI
rejects the verified value, use the scoped list and report the compatibility
limitation. Leave CLI installation and shared helper changes to separate work.

## Paginate before local processing

Use the same entry point, server, exact profile key, scope, field selection,
ordering, and page size on every page:

1. Read page 1 as JSON. Use the returned pager total and effective `recPerPage`
   to compute the number of pages; inspect the installed response shape
   (`total` or `recTotal`) rather than assuming the requested page size was used.
2. Read all remaining pages, at most three concurrently. Keep explicit
   pagination on both paths; do not pass `--all` or a CLI `--limit`.
3. If a page fails, identify it and stop or retry the same page with the same
   login. Do not call partial data complete. If the pager is missing or
   inconsistent, establish its contract before claiming completeness.
4. Combine and de-duplicate all rows, then follow the main skill's filtering,
   ordering, and display steps.

Keep API reads free of CLI `--filter`, `--search`, `--sort`, and `--limit`.
These operate on each fetched page, obscuring raw page lengths, missing fields,
and ordering evidence. A single local pass over combined rows also avoids the
old equality-syntax and repeated-filter AND/OR traps. Server-side `--filters`
are unnecessary for this workflow.

Do not stop because one page has no matching rows, displays fewer rows than
requested, or appears sorted by status. A monotonic first page does not prove
global server ordering. Full pagination is the completeness rule; `id_asc`
provides a stable requested order, not permission to skip pages.

## Evidence for the compatibility rule

- [Official CLI documentation](https://github.com/easysoft/zentao-cli/blob/main/docs/cli-usage.md#api-覆盖与版本兼容)
  documents the corrected case-sensitive `assignedTo` browse value in newer SDKs.
- Verified on 2026-10-16 with CLI 0.3.0 and ZenTao 22.6: two reads with the same
  profile and projection returned 7 assigned rows for `assignedTo` and 0 for
  `assignedtome`. This explains that failure without attributing it to version,
  permissions, or missing user data.
