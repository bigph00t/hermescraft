# RunPod SSH — READ THIS FIRST

RunPod's SSH proxy DOES NOT work with normal `ssh` commands.
It rejects non-PTY sessions. You MUST use `expect`.

## Connection Details

- **User**: `rr8am4a2u1wx9q-644113a2`
- **Host**: `ssh.runpod.io`
- **Key**: `~/.ssh/id_ed25519`
- **Project dir**: `/workspace/hermescraft`

## The ONLY Working Pattern

```bash
expect -c '
set timeout 60
spawn ssh -o StrictHostKeyChecking=no -i /home/bigphoot/.ssh/id_ed25519 rr8am4a2u1wx9q-644113a2@ssh.runpod.io
expect -re {\$ }
send "YOUR_COMMAND && echo DONE_MARKER\r"
expect -re {DONE_MARKER.*\$ }
send "exit\r"
expect eof
' 2>&1 | grep -v "^spawn\|RUNPOD\|Enjoy\|^\-\-\|^Warning\|known_hosts"
```

## Deploy Changes

```bash
expect -c '
set timeout 60
spawn ssh -o StrictHostKeyChecking=no -i /home/bigphoot/.ssh/id_ed25519 rr8am4a2u1wx9q-644113a2@ssh.runpod.io
expect -re {\$ }
send "cd /workspace/hermescraft && git pull && echo PULL_DONE\r"
expect -re {PULL_DONE.*\$ }
send "exit\r"
expect eof
' 2>&1 | grep -v "^spawn\|RUNPOD\|Enjoy\|^\-\-\|^Warning\|known_hosts"
```

## DO NOT TRY

- `ssh -T user@ssh.runpod.io` — FAILS
- `echo "cmd" | ssh user@ssh.runpod.io` — FAILS
- `ssh -tt user@ssh.runpod.io 'cmd'` — HANGS
- `/ssh` skill — NOT SAVED, WON'T WORK

## Rules

- Use unique echo markers per command (e.g., `PULL_DONE`, `BUILD_DONE`)
- Use `\r` line endings, NOT `\n`
- Timeout: 30s for quick, 300s+ for builds/downloads
- Filter RunPod noise with the grep at the end
