# Execute through local OpenSSH

## Connection and identity

Use the installed `ssh` executable. Resolve only the selected alias; `ssh -G
<alias>` can inspect effective configuration including `Include`/`Match`.
It is not a connection test and may evaluate the user's `Match exec` commands.
Read only needed output fields; do not dump the full configuration into chat.
Do not replace working SSH routing with a different address or account.

For unattended inspection, start with this pattern, replacing the example alias
with the validated target:

```sh
ssh -T -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 \
  -o StrictHostKeyChecking=yes -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=2 -- orders-test 'hostname && id -un && uname -s'
```

Check probe stdout/stderr and exit status. The `&&` chain stops on failure;
compare the configured expected hostname before service access.

`BatchMode` avoids credential prompts. Use existing `ssh-agent`, key files, or
SSH certificate configuration. If password/MFA/key unlocking is required,
report the exact blocker and let the user authenticate through their trusted
terminal or supported interactive flow. Do not request passwords in chat,
print them, pass them as arguments, or install `sshpass` to bypass the blocker.

Unknown or changed host keys require resolving host trust through a trusted
fingerprint/source. Do not disable verification, remove known-host entries, or
trust `ssh-keyscan` output alone. Preserve the user's jump-host configuration;
do not enable agent forwarding as a workaround.

## Local and remote shells

Validate aliases against the inventory contract, including ephemeral aliases
supplied explicitly by the user. Pass options before `--` and the alias.
Reject aliases outside the contract instead of letting them become options or
shell fragments. If the user supplies only an address/user/port, collect or
prepare a requested SSH alias rather than silently persisting a new connection.

SSH sends a command string to the remote shell. Local argument separation does
not quote remote paths or service names. Quote each dynamic remote value for
the actual remote shell; never interpolate untrusted inventory/log values into
an executable command. Use proper POSIX single-quote escaping for POSIX shells
or a safely constructed quoted heredoc when sending a script. Do not use `eval`.
If the remote shell/platform is unknown, establish it before a shell-specific
script. The initial runbooks target Linux; adapt explicitly for other systems.

Use non-PTY commands (`-T`) and disable pagers/color where supported. Avoid an
interactive login shell for ordinary inspection. If sending a script to
`sh -s`, stdin carries that script: do not add `-n`, and do not run commands
inside the script that consume the remaining stdin accidentally.

## Time, output, and failures

- Set a command deadline in the calling execution tool (start at 30 seconds
  for ordinary checks). A tool's initial wait/yield duration is not a deadline;
  resume running jobs rather than reissuing the command. `ConnectTimeout` and
  SSH keepalives do not limit how long a healthy remote command can run.
  If the caller has no deadline feature, use an available bounded subprocess
  wrapper rather than inventing an unsupported tool parameter.
- Bound log commands at the source, typically a 15-minute window and 200 lines.
  Avoid endless `tail -f`, unrestricted recursive search, and unfiltered output.
  Use caller output caps too, disclose truncation, and narrow subsequent checks.
- Preserve the remote command status and relevant stderr. `ssh` commonly uses
  255 for connection/client failures; a remote command can also exit 255, so
  inspect stderr before assigning a cause. Avoid pipelines that hide the status
  of the command being diagnosed; inspect commands separately when necessary.
- Do not silence failures with `|| true` or present denied access as no results.
  For logs needing elevated access, use `sudo -n` only within authorized scope.
- A local timeout/disconnection does not prove remote termination. For a change,
  establish current state before any retry; report an unknown outcome honestly.

When the execution tool has no deadline and `python3` is already available, this
local wrapper bounds a read-only check without changing remote configuration:

```sh
python3 - <<'PY'
import subprocess
import sys

try:
    result = subprocess.run([
        'ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=yes', '--', 'orders-test', 'uptime',
    ], timeout=30)
except subprocess.TimeoutExpired:
    print('Local SSH timed out; remote completion is unknown.', file=sys.stderr)
    sys.exit(124)
sys.exit(result.returncode)
PY
```

Use the actual alias/command and caller output caps. This example inherits
stdout/stderr instead of buffering an unlimited result. Do not install Python
solely for this wrapper; use an existing bounded execution mechanism instead.

Reference behavior: [ssh](https://man.openbsd.org/ssh.1) and
[ssh_config](https://man.openbsd.org/ssh_config). Check the installed version
when an option is unavailable; do not weaken host verification to proceed.
