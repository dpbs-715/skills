# Scoped Bug list

Read this file when the Query Bugs section of `../SKILL.md` selects the
scoped path: an older CLI or server, a failed fast-path probe, or a query
spanning all assignees.

Build a read-only Bug list command using the selected `.zentao` scope.
With a non-null product, the first page of the default query is:

```sh
node <connection-script> run --server '<server>' --profile '<profile-key>' -- \
  bug --product=<product-id> --page=1 --recPerPage=1000 --orderBy=status_asc \
  --filter='assignedTo:<account>,status:active' \
  --pick=id,title,severity,pri,status,assignedTo,openedDate
```

With `product: null`, replace `--product=<product-id>` with
`--project=<project-id>`. The installed CLI supports project-scoped Bug lists;
do not fall back to the global workspace merely because a product is absent.

## Filter syntax

Use `:` for equality in CLI filters for compatibility with released versions.
Within one `--filter`, comma-separated conditions are AND. Repeated `--filter`
options are OR. For example, the default assignee and status constraints belong
in the same expression shown above. Do not use `field=value` merely because an
installed help string shows it: `zentao-cli` 0.2.0 silently fails to interpret
that equality form.

## Do not shortcut with `browseType`

Do not rely on `browseType=assignedtome` as a shortcut on this endpoint. The
value was incorrect in older `zentao-api` metadata (`assignedtome` versus
`assigntome`), and some project-scoped ZenTao endpoints ignore it entirely
(observed on ZenTao 22.2: the pager total stays unchanged). This warning does
not apply to the `my bugs` fast path, where `browseType` is the native
contract. On this path, the `orderBy` status-ordering strategy in
[pagination.md](pagination.md) is the supported optimization; explicit full
pagination remains the source of truth for all-status queries and for servers
that ignore `orderBy`.

Pagination, ordering, and aggregation follow
[pagination.md](pagination.md) with `--recPerPage=1000`, the maximum declared
by the Bug list contract.
