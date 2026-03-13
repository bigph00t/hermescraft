# Charles Hermes Summary

## Overview

This is the current Charles deployment built on Hermes Agent and hosted on the Windows machine `glass`.

High-level shape:

- Windows host: `glass`
- Linux runtime: Ubuntu on WSL2 on `glass`
- Hermes install: `/home/charles/.hermes/hermes-agent`
- Main Windows root: `C:\charles`
- Main chat surface: Telegram bot `@charlesaibot_bot`
- LLM provider: OpenRouter
- Default model: `openrouter/hunter-alpha`
- Auxiliary / fallback model: `openrouter/healer-alpha`

The intended operating model is:

- normal deep research and coding through Hermes
- long-running work via detached `charles-job` tasks
- headed/browser/native-dialog work via the Windows `glass-gui` bridge

## SSH / Host Access

From this Linux machine, `glass` is already configured in SSH config.

SSH alias details:

- host alias: `glass`
- hostname: `100.107.50.95`
- ssh user: `Server PC 1`
- identity file: `~/.ssh/id_ed25519`

Primary SSH command:

```bash
ssh glass
```

Useful WSL entry command:

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'pwd && whoami'"
```

## Runtime Layout

### Windows side

- root: `C:\charles`
- projects: `C:\charles\workspace\projects`
- research: `C:\charles\workspace\research`
- downloads: `C:\charles\workspace\downloads`
- task state: `C:\charles\state\tasks`
- logs: `C:\charles\state\logs`
- secrets file: `C:\charles\secrets\hermes.env`
- helper scripts: `C:\charles\bin`

### WSL side

- user: `charles`
- home: `/home/charles`
- Hermes home: `/home/charles/.hermes`
- Hermes config: `/home/charles/.hermes/config.yaml`
- Hermes env: `/home/charles/.hermes/.env`
- gateway log: `/home/charles/.hermes/logs/gateway.log`
- error log: `/home/charles/.hermes/logs/errors.log`
- detached gateway tmux session: `charles-gateway`

### Local deployment bundle on this machine

- bundle root: `/home/bigphoot/Charles_Hermes`
- key bootstrap script: `/home/bigphoot/Charles_Hermes/glass/windows/bootstrap-charles.ps1`
- key WSL config writer: `/home/bigphoot/Charles_Hermes/glass/wsl/configure-charles.sh`
- gateway launcher: `/home/bigphoot/Charles_Hermes/glass/wsl/start-gateway.sh`

## Telegram

- bot username: `@charlesaibot_bot`
- paired Telegram user id: `8681670095`
- paired display name: `Alec`
- Telegram home channel id: `8681670095`
- detached-task notification chat id: `8681670095`

Pairing state:

- pairing was completed successfully with code `N4SPWHXE`
- approved users are stored under `/home/charles/.hermes/pairing/`

Important note:

- do not store or copy the raw bot token into documents
- the live token is stored in:
  - `C:\charles\secrets\hermes.env`
  - `/home/charles/.hermes/.env`

## Current Hermes Model / Routing

Live config currently resolves to:

```yaml
model:
  default: "openrouter/hunter-alpha"
  provider: "openrouter"
  base_url: "https://openrouter.ai/api/v1"

provider_routing:
  ignore:
    - "Stealth"
  require_parameters: true

fallback_model:
  provider: "openrouter"
  model: "openrouter/healer-alpha"
```

Why this changed:

- earlier config used `provider_routing.sort: "throughput"`
- OpenRouter repeatedly routed Charles to backend `Stealth`
- that backend produced `502 Provider returned error`
- routing was changed to explicitly ignore `Stealth`
- `healer-alpha` was added as fallback

## Windows Control Bridges

Charles uses two Windows-side execution lanes:

### 1. `glass-exec`

For PowerShell, git, file ops, repo setup, and normal Windows commands.

Examples:

```bash
glass-exec --cmd "Write-Output 'hello'"
glass-exec --cwd /mnt/c/charles/workspace/projects --cmd "git status"
```

### 2. `glass-gui`

For actual desktop interaction through TightVNC.

Available actions:

- `glass-gui screenshot --out <path>`
- `glass-gui run-plan <path>`

Use this for:

- headed browsing
- popups
- native dialogs
- downloads
- login flows that need a real desktop

Important:

- VNC host is the same machine address: `100.107.50.95`
- the VNC password exists in the secrets env files
- it is intentionally not copied into this summary

## Background Jobs

Detached work is handled by `charles-job`.

Primary commands:

```bash
charles-job start --name "research-task" "research prompt here"
charles-job list
charles-job status <task_id>
charles-job cancel <task_id>
```

Task output structure:

- `task.json`
- `status.json`
- `updates.log`
- `artifacts/`
- `final.md`

Task folders live under:

- `C:\charles\state\tasks`

Notifications:

- completed / cancelled detached jobs can send Telegram notifications
- that path uses `TELEGRAM_BOT_TOKEN` + `CHARLES_TELEGRAM_CHAT_ID`

## Gateway Startup / Persistence

Gateway launcher flow:

1. Windows scheduled task `CharlesHermesGateway`
2. task launches WSL as user `charles`
3. WSL runs `bash /mnt/c/charles/bootstrap/wsl/start-gateway.sh`
4. that script creates tmux session `charles-gateway`
5. tmux runs:

```bash
hermes --yolo gateway run
```

Manual restart:

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'bash /mnt/c/charles/bootstrap/wsl/restart-gateway.sh'"
```

Quick health check:

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'tmux ls; ps -ef | grep \"[h]ermes --yolo gateway run\"; tail -n 40 ~/.hermes/logs/gateway.log'"
```

## What Was Verified

Previously verified:

- Hermes installs cleanly in WSL2 on `glass`
- `glass-exec` works
- `glass-gui screenshot` works against the Windows desktop
- `charles-job` completed a detached `READY` test successfully
- Telegram pairing succeeded
- gateway can run in tmux and poll Telegram

## Current Known Issue

The original "no response" report had two distinct causes:

### 1. Gateway was down

- there was a period where `charles-gateway` was not running
- that meant Telegram messages had no active poller
- this was fixed by restarting the tmux-backed gateway

### 2. OpenRouter provider instability

- when Hermes did run the Telegram message path, OpenRouter sometimes returned:
  - `502 Provider returned error`
  - provider metadata: `Stealth`
- Hermes logged the failure and sent its generic fallback error response to Telegram
- config was updated to avoid `Stealth` and add `healer-alpha` fallback

Current honest status:

- gateway is running again
- routing config is improved
- a fresh live DM validation after the routing change is still the key final check

## Useful Commands

### Check pairing / approved users

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'source ~/.hermes/.env >/dev/null 2>&1; hermes pairing list'"
```

### Inspect live config

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'sed -n \"1,120p\" ~/.hermes/config.yaml'"
```

### Inspect error log

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'tail -n 120 ~/.hermes/logs/errors.log'"
```

### Inspect task state

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'ls -lt /mnt/c/charles/state/tasks | head'"
```

### Restart gateway

```bash
ssh glass "wsl.exe -d Ubuntu -u charles -- bash -lc 'bash /mnt/c/charles/bootstrap/wsl/restart-gateway.sh'"
```

## Important Files to Know

On this Linux machine:

- `/home/bigphoot/Charles_Hermes/glass/wsl/configure-charles.sh`
- `/home/bigphoot/Charles_Hermes/glass/wsl/start-gateway.sh`
- `/home/bigphoot/Charles_Hermes/glass/wsl/files/charles-job.py`
- `/home/bigphoot/Charles_Hermes/glass/context/SOUL.md`
- `/home/bigphoot/Charles_Hermes/glass/context/TOOLS.md`

On `glass`:

- `/home/charles/.hermes/config.yaml`
- `/home/charles/.hermes/.env`
- `/home/charles/.hermes/logs/gateway.log`
- `/home/charles/.hermes/logs/errors.log`
- `/home/charles/.hermes/sessions/sessions.json`
- `/mnt/c/charles/bootstrap/wsl/start-gateway.sh`
- `/mnt/c/charles/bootstrap/wsl/restart-gateway.sh`
- `/mnt/c/charles/state/tasks`

## Secrets Handling

Do not put raw values into notes unless explicitly needed.

Important secret locations:

- `C:\charles\secrets\hermes.env`
- `/home/charles/.hermes/.env`

Those env files contain things like:

- Telegram bot token
- OpenRouter API key
- VNC password
- optional research provider keys

## Short Status Snapshot

As of March 13, 2026:

- Charles lives on `glass`, not on this Linux machine
- Telegram bot is `@charlesaibot_bot`
- Hermes runs inside WSL2 as user `charles`
- gateway persistence uses tmux + Windows scheduled task
- detached task system is working
- browser / desktop control bridge is working
- main remaining operational risk is OpenRouter free-provider reliability under the Telegram/Hermes gateway path
