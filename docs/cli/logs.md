---
summary: "CLI reference for `razroom logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `razroom logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
razroom logs
razroom logs --follow
razroom logs --json
razroom logs --limit 500
razroom logs --local-time
razroom logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
