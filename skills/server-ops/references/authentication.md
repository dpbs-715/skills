# Authenticate, verify, and continue

Use two paths: connect automatically when existing access works, or let the user
complete authentication locally and then resume. Keep the selected alias,
resolved user/host/port and jump route, connection mode/socket when used, and
unfinished operation in the task context. Do not store authentication methods,
control sockets, passwords, or tokens in the server inventory.

## Choose the path

| Existing access | Action |
| --- | --- |
| Usable key file or key already available through `ssh-agent` | Try the bounded noninteractive identity probe. |
| Valid SSH certificate and usable corresponding key | Use the configured identity; report expiry or authorization failures as returned. |
| Encrypted key not yet available to the agent | Ask the user to unlock/load the selected key into the same agent available to this task, then retry the read-only probe. |
| Password or keyboard-interactive MFA | Have the user establish a reusable authenticated connection in their trusted terminal, then verify and reuse that connection. |
| Hardware key, PIN, touch, or agent approval | Use the established local confirmation flow if available; otherwise use the trusted-terminal path. Do not promise unattended execution. |
| Other configured OpenSSH authentication | Reuse it only if the installed client, server, and existing credentials support it; otherwise report the precise prerequisite. |

`BatchMode=yes` disables SSH credential prompts; it does not mean "keys only".
`-T` disables a remote PTY, not local authentication prompts. A PTY offered by an
execution tool is not itself a private credential-entry interface. Use a client
flow only when secrets stay outside agent/tool transcripts; otherwise provide
commands for the user's own terminal. Never ask for passwords, passphrases,
PINs, or one-time codes in chat or tool input, and do not use `sshpass` or
`expect` to supply them.

## Check the selected route, including jump hosts

Inspect only relevant effective settings with `ssh -G <alias>`: routing,
authentication availability, host-key policy, and connection reuse. This may
evaluate `Match exec`; it is not a connection or authentication test.

Destination command-line options generally do not reach `ProxyJump` children.
For each actual SSH hop, verify that automatic access will not prompt and host
verification remains strict. Use existing per-hop settings or a verified
already-authenticated route. An outer `BatchMode=yes` or
`StrictHostKeyChecking=yes` alone is insufficient evidence for the jump host.
Do not probe every inventory host or connect to later hops directly when the
route requires an earlier hop. Preserve configured usernames and ports.

If any hop requires interaction, use the user-authentication path for the
selected route after verifying each hop's host-key policy. Report which hop
needs attention. Do not silently edit SSH config, insert a different proxy,
enable agent forwarding, or flatten the route. Treat custom `ProxyCommand`
wrappers according to their verified behavior; do not parse or rewrite their
shell text as if it were a simple alias list. If per-hop behavior cannot be
established, report that gap before claiming an unattended route is ready.

Unknown or changed host keys are a host-trust problem. Stop and resolve them
using a trusted fingerprint/source before credential entry; a password prompt
is not permission to accept an unknown host. Network/DNS/timeouts, host-trust
errors, authentication rejection, expired credentials, and remote permissions
are different outcomes. Do not present every failure as "enter your password".

## Complete authentication locally

For a locked key, show the exact `ssh-add <verified-identity-file>` command for
the selected identity, with proper shell quoting. The user enters its passphrase
locally. Loading a key into an unrelated terminal's agent does not help this
task: verify agent availability from the execution context before retrying.

For password/MFA, an ordinary `ssh <alias>` login does not make later independent
connections authenticated. Use an existing master for this alias when verified,
or give the user a concrete command to create a temporary task-owned master.
This example is for the user's trusted local terminal, not an agent credential
prompt. Replace the alias with the selected target; for jump routes first meet
the per-hop checks above:

```sh
umask 077
server_ops_dir="$(mktemp -d /tmp/server-ops.XXXXXXXX)"
server_ops_socket="$server_ops_dir/control"
if ssh -M -S "$server_ops_socket" -fNT -o ControlPersist=600 \
  -o BatchMode=no -o StrictHostKeyChecking=yes \
  -o ConnectTimeout=10 -o ConnectionAttempts=1 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=2 \
  -o ClearAllForwardings=yes -o ForwardAgent=no -o ForwardX11=no \
  -- orders-test; then
  printf 'Connection socket: %s\n' "$server_ops_socket"
else
  server_ops_status=$?
  printf 'Connection setup failed (SSH exit %s).\n' "$server_ops_status" >&2
fi
```

`-N` starts no remote command; `-f` backgrounds only after authentication. The
master expires after 600 idle seconds. Share only its socket path and success
status with the task, never credentials. If creation fails, report the error;
the printed path alone does not prove a connection exists. Ordinary SSH setup
and the inventory remain unchanged. Do not install dependencies for this flow.

## Verify before resuming

Before using a supplied socket, ensure it is a Unix socket owned by the current
local user inside an owner-only directory also owned by that user. Reject
symlinks at the socket or its immediate parent; do not repair unrelated paths
or permissions automatically. Pin it to this task's selected alias
and resolved endpoint; do not scan sockets or reuse an unrelated session.
`ssh -S <socket> -O check -- <alias>` verifies a listening master, not the remote
host's identity or service health. Use a bounded read-only identity probe next.

For a verified master, keep these options on the probe and every later command:

```sh
ssh -S "$server_ops_socket" -T -o ControlMaster=no -o BatchMode=yes \
  -o ProxyCommand=false -o StrictHostKeyChecking=yes \
  -o ClearAllForwardings=yes -o ForwardAgent=no -o ForwardX11=no \
  -- orders-test 'hostname && id -un && uname -s'
```

`ProxyCommand=false` prevents a fresh connection if the master disappears;
otherwise OpenSSH can fall back even with `-S`. It does not change the already
authenticated master's route. Check the remote hostname and user against the
selected task context before accessing services. A reused connection inherits
its established host trust; command-line flags do not revalidate that handshake.

After verification, resume the unfinished task with its existing authorization.
Do not restart the workflow, change the target, repeat a completed change, or
ask the user to authorize the same operation again. If a disconnect occurred
during a write, its outcome remains unknown: first inspect current state through
read-only commands and decide what remains to be done.

When reuse fails, return to authentication for the same target. Do not silently
fall back to a new route or retry the interrupted write. Close only a master
created specifically for this task, using `ssh -S <socket> -O exit -- <alias>`
after no commands are using it, then remove its empty task directory. Preserve
pre-existing/shared masters and report any connection intentionally left open.

## Handle sudo separately

Successful SSH authentication does not establish sudo authorization. Prefer
`sudo -n <exact-authorized-command>` when needed. A password request, lack of
permission for that command, or a required terminal must be reported separately.
Do not broaden sudo rights or change sudoers to continue.

If sudo needs a password/terminal, prepare the exact authorized remote command
and let the user execute it in their trusted terminal, allocating a remote PTY
only for that manual step when required. Keep any verified socket and endpoint
pinning in that command. Never feed the password with `sudo -S`, tool input, or
a chat message. On return, inspect the operation's result; do not rerun it.

Do not promise that `ssh -t <alias> sudo -v` enables a later `ssh -T ... sudo -n`:
sudo timestamps can be scoped to a terminal/session. Automatic continuation
requires verifying the actual noninteractive operation's permission. If the
user cannot complete the manual step, report that exact blocker and leave the
operation pending.

References: [OpenSSH connection sharing and jump-host configuration](https://man.openbsd.org/ssh_config),
[OpenSSH command options](https://man.openbsd.org/ssh),
and [sudo timestamp behavior](https://www.sudo.ws/docs/man/sudoers.man/).
