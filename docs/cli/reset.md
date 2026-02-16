---
summary: "CLI reference for `razroom reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `razroom reset`

Reset local config/state (keeps the CLI installed).

```bash
razroom reset
razroom reset --dry-run
razroom reset --scope config+creds+sessions --yes --non-interactive
```
