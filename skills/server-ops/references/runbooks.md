# Focused Linux diagnosis

These are examples of remote commands, not a script to run wholesale. Replace
sample names with verified service identifiers and quote dynamic values using
the SSH guide. Run each relevant check separately so its failure is visible.
Use the user's time window; when absent, disclose the default 15-minute/200-line
sample. Use remote timestamps and compare timezones for an explicit incident time.

## First checks

After the identity probe, choose checks relevant to the symptom:

```sh
date -Is
uptime
df -h / /srv
free -m
```

`/srv` is an example; use the verified service filesystem. Missing tools,
permissions, and unsupported platforms need explicit handling rather than
installing software or interpreting failed output as healthy state. Check
resource saturation, service health, and dependencies as evidence warrants.
Do not reboot, delete logs, or prune containers as a diagnostic shortcut.

## systemd service

For a verified unit such as `orders-api.service`:

```sh
systemctl show orders-api.service --no-pager --property=LoadState,ActiveState,SubState,Result,ExecMainStatus
journalctl -u orders-api.service --since '15 minutes ago' -n 200 --no-pager -o short-iso
```

Check `LoadState` as well as command success; a lookup can report a missing unit
without the result the user expects. Inspect failure timestamps and the error
context. Restrict journal access to this unit/window. Permission-denied or a
restricted journal view is incomplete evidence, not proof there are no errors.
Avoid dumping service environment variables or full unit files without need.

A requested and in-scope restart can use `systemctl restart` (with authorized
`sudo -n` where necessary). Check current state first, then the new state,
post-operation logs, and established application readiness behavior. Do not
restart every unit that shares a prefix.

## Docker and Compose

For a verified container:

```sh
docker container inspect --format '{{json .State.Status}} {{json .State.Running}} {{json .State.ExitCode}}' orders-api
docker logs --since 15m --tail 200 --timestamps orders-api
```

Inspect only needed fields; full container configuration can contain secrets.
Where a health check is configured, inspect its status separately. Docker log
drivers and access can limit available logs; empty output is not a health check.

For Compose, resolve the deployment's project, compose file(s), and service first.
Use explicit verified context rather than the local directory's default project:

```sh
docker compose -p orders -f /srv/orders/compose.yaml ps orders-api
docker compose -p orders -f /srv/orders/compose.yaml logs --since 15m --tail 200 --timestamps --no-color orders-api
```

Use the deployment's actual file set and workdir; do not guess a file or run
`compose up`, `down`, or a project-wide restart as an inspection step. An
authorized service restart is scoped to that verified service. Check health
and application behavior afterward.

## File logs and follow-up

When a known service writes to a file, start with `tail -n 200 -- <quoted-path>`.
Label this as a line sample: it does not guarantee 15 minutes of coverage.
For explicit incident windows or large files, use known timestamps and bounded
queries, accounting for rotated logs if relevant. Do not `cat` a whole log tree
or continuously follow logs unless the user requested a bounded watch.

Correlate errors with dependency availability and recent changes. Distinguish
a demonstrated cause from a hypothesis needing another check. Health checks
must be established non-mutating endpoints/commands; do not invent a URL or
reuse a business endpoint that changes state.

Documentation: [journalctl](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html),
[Docker logs](https://docs.docker.com/reference/cli/docker/container/logs/).
