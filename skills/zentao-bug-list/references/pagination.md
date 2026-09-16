# Pagination, ordering, and aggregation

This contract is shared by both query paths selected in `../SKILL.md`. The
scoped Bug list uses `--recPerPage=1000` (the maximum declared by the Bug
list contract); the `my bugs` fast path uses `--recPerPage=200`.

## Status ordering with early stop

Reduce fetching with server-side status ordering when the query restricts
status (the default `active`, or explicit status values). Bug statuses sort as
`active` < `closed` < `resolved` under `orderBy=status_asc`. Endpoints that
ignore `browseType` may still honor `orderBy` (verified on a ZenTao 22.2
project-scoped endpoint with `zentao-cli` 0.2.0: `browseType` and `status`
params were ignored, `orderBy` was applied). Add the API parameter directly:

- requested statuses include `active` → `--orderBy=status_asc`;
- else requested statuses include `resolved` → `--orderBy=status_desc`;
- else (`closed` only) → `--orderBy=status_asc`.

Then fetch pages sequentially, stopping after the first page that contains a
status sorting strictly after every requested status in the chosen direction
(`active`: stop at the first `closed` or `resolved`; `resolved` under
`status_desc`: stop at the first `closed` or `active`; `closed`: stop at the
first `resolved`), or that returns fewer rows than `recPerPage`, or that
reaches the pager's last page. Later pages cannot match the status filter.
This commonly reduces the default assigned-to-me active query to a single
page even in scopes with thousands of historical Bugs.

Before relying on the stop condition, verify page 1 actually honors `orderBy`:
row statuses must be monotonically ordered in the requested direction. A
monotonic page proves no requested-status rows exist beyond it. If page 1
violates the ordering, the server ignored `orderBy`: drop the parameter and
fall back to full pagination below. Use full pagination whenever the query
spans all statuses.

## Full pagination protocol

Treat pagination as an explicit part of correctness:

1. Request page 1 with the path's page size. On the scoped path, do not pass
   `--all`: released versions may silently ignore it and newer versions may
   reject it because automatic pagination is not implemented.
2. Read `pager.total` and `pager.recPerPage` from the JSON response and compute
   the total page count. A filtered `data: []` on page 1 is not an empty final
   result when the pager reports later pages.
3. Fetch every remaining page with the same server, exact profile key, scope,
   filters, search, pick, and page size through the helper. Use bounded parallel
   reads, at most three pages at a time, when the execution environment supports
   parallel tool calls. When the status-ordering early stop above applies,
   fetch sequentially instead and stop at the first page meeting the stop
   condition; do not fetch beyond it.
4. If any page fails or times out, do not call the result complete. Report the
   failed page numbers and stop or offer a retry.
5. Combine all page data, de-duplicate by Bug ID, then apply the requested
   global ordering and display limit. Never apply a CLI `--limit` before all
   pages are combined, and do not rely on per-page sorting for the final order.

The CLI applies `--filter`, `--search`, `--sort`, and `--limit` after retrieving
each page. Filtering or searching every page with the same expression is safe;
filtering or searching only page 1 is not. Always perform the final ordering and
limit after aggregation.
