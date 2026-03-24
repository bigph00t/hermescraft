---
name: Never rsync .env to Glass
description: rsync --delete overwrites Glass .env with local keys. Always exclude .env from rsync to Glass.
type: feedback
---

NEVER rsync .env files to Glass. The local .env has Nous Research API keys. Glass uses MiniMax keys at /opt/hermescraft/v2/.env. Always add `--exclude '.env'` to rsync commands targeting Glass.

**Why:** rsync --delete replaced the Glass MiniMax .env with local Nous keys, causing agents to hit the wrong API.

**How to apply:** Every rsync to glass:/opt/hermescraft/v2/ must include `--exclude '.env'`.
