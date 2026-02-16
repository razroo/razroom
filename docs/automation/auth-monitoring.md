---
summary: "Monitor OAuth expiry for model providers"
read_when:
  - Setting up auth expiry monitoring or alerts
  - Automating Claude Code / Codex OAuth refresh checks
title: "Auth Monitoring"
---

# Auth monitoring

Razroom exposes OAuth expiry health via `razroom models status`. Use that for
automation and alerting; scripts are optional extras for phone workflows.

## Preferred: CLI check (portable)

```bash
razroom models status --check
```

Exit codes:

- `0`: OK
- `1`: expired or missing credentials
- `2`: expiring soon (within 24h)

This works in cron/systemd and requires no extra scripts.

## Optional scripts (ops workflows)

These live under `scripts/` and are **optional**. They assume SSH access to the
gateway host and are tuned for systemd.

- `scripts/claude-auth-status.sh` now uses `razroom models status --json` as the
  source of truth (falling back to direct file reads if the CLI is unavailable),
  so keep `razroom` on `PATH` for timers.
- `scripts/auth-monitor.sh`: cron/systemd timer target; sends alerts (ntfy or phone).
- `scripts/systemd/razroom-auth-monitor.{service,timer}`: systemd user timer.
- `scripts/claude-auth-status.sh`: Claude Code + Razroom auth checker (full/json/simple).

If you don't need systemd timers, skip these scripts.
