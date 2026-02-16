---
summary: "CLI reference for `moltbot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `moltbot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
moltbot logs
moltbot logs --follow
moltbot logs --json
moltbot logs --limit 500
moltbot logs --local-time
moltbot logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
