---
summary: "CLI reference for `razroom agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `razroom agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
razroom agents list
razroom agents add work --workspace ~/.razroom/workspace-work
razroom agents set-identity --workspace ~/.razroom/workspace --from-identity
razroom agents set-identity --agent main --avatar avatars/razroom.png
razroom agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.razroom/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
razroom agents set-identity --workspace ~/.razroom/workspace --from-identity
```

Override fields explicitly:

```bash
razroom agents set-identity --agent main --name "Razroom" --emoji "🦞" --avatar avatars/razroom.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Razroom",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/razroom.png",
        },
      },
    ],
  },
}
```
