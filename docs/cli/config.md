---
summary: "CLI reference for `razroom config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `razroom config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `razroom configure`).

## Examples

```bash
razroom config get browser.executablePath
razroom config set browser.executablePath "/usr/bin/google-chrome"
razroom config set agents.defaults.heartbeat.every "2h"
razroom config set agents.list[0].tools.exec.node "node-id-or-name"
razroom config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
razroom config get agents.defaults.workspace
razroom config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
razroom config get agents.list
razroom config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
razroom config set agents.defaults.heartbeat.every "0m"
razroom config set gateway.port 19001 --json
razroom config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.
