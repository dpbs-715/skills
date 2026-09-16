# Fast path: `my bugs`

Read this file only when the query targets the bound account and the version
gate below passes (or to evaluate the gate). Otherwise return to the Query
Bugs section of `../SKILL.md`.

`zentao-cli` 0.3.0 added `zentao my bugs`, a server-side "Bugs assigned to
me" API. It requires ZenTao server 22.5 / biz13.5 / max8.5 / ipd5.5 or newer;
the exact minimums are printed by `my bugs --help` (run help reads through
the connection helper).

## Gate

Read both versions with one helper call, which runs `zentao version` on the
bound profile:

```sh
node <connection-script> run --server '<server>' --profile '<profile-key>' -- version
```

The helper returns `{ cli, serverVersion, server }`, for example
`{ "cli": "0.3.0", "serverVersion": "22.2", "server": "http://..." }`.

- CLI: `cli` is 0.3.0 or newer and `my bugs --help` exists (run help reads
  through the helper).
- Server: compare `serverVersion` against the minimums from `my bugs --help`.
  Series numbering differs (open-source `22.5` versus `biz13.5`, `max8.5`,
  `ipd5.5`); never compare numbers across series.
- When the version clearly meets the minimum, use the fast path but still
  treat error code `2010` as a fallback signal. When it is clearly below the
  minimum, use the scoped path without probing. When the version cannot be
  read or the series is ambiguous, probe once with the fast-path command and
  fall back on `2010`.

Use the fast path only when the assignee scope is the bound account (the
default query). On any version failure, and whenever the query spans all
assignees, use [the scoped Bug list](scoped-list.md) for the rest of the
session.

## Default query

Scoped to a non-null product:

```sh
node <connection-script> run --server '<server>' --profile '<profile-key>' -- \
  my bugs --browseType=assignedtome --orderBy=status_asc \
  --page=1 --recPerPage=200 \
  --filter='product:<product-id>,status:active' \
  --pick=id,title,severity,pri,status,assignedTo,openedDate,product,project
```

With `product: null`, filter on `project:<project-id>` instead of
`product:<product-id>`.

## Contract notes

- `--browseType=assignedtome` is the native server-side contract of this API
  (unlike the `bug` list endpoint, where `browseType` is unreliable; see
  [scoped-list.md](scoped-list.md)). Values: `all`, `unclosed`,
  `assignedtome`, `openedbyme`, `resolvedbyme`. Keep `assignedtome` for the
  default query; the API already restricts results to the bound account, so
  never add an `assignedTo` filter on this path.
- `my bugs` has no `--product`/`--project` context option. Preserve the
  `.zentao` scope with a client-side `--filter` on the `product` (or
  `project`) response field, applied to every page, and verify page 1 rows
  actually match the scope. If the response carries no usable scope field,
  abandon the fast path and use [the scoped Bug list](scoped-list.md).
- Server-side `--filters` (a JSON array of
  `field`/`operator`/`value`/`join`/`group` items; see `my bugs --help`)
  supports `status`, `severity`, `pri`, `product`, `project`, and more, and
  can shrink the fetched set further. Treat it as an optimization only: keep
  the per-page client-side `--filter`/`--search` as the source of truth
  unless a probe proves the server honored `--filters` (the pager total
  shrinks and the returned rows match).
- `--orderBy=status_asc` is native to this API. Pagination, the page-1
  monotonic verification, the status early stop, and the final
  ordering/aggregation rules are shared with the scoped path: follow
  [pagination.md](pagination.md) with `--recPerPage=200` as the page size.
  Totals are far smaller than a product-wide scan.
