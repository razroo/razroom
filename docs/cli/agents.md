---
summary: "CLI reference for `moltbot agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `moltbot agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
moltbot agents list
moltbot agents add work --workspace ~/.moltbot/workspace-work
moltbot agents set-identity --workspace ~/.moltbot/workspace --from-identity
moltbot agents set-identity --agent main --avatar avatars/moltbot.png
moltbot agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.moltbot/workspace/IDENTITY.md`
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
moltbot agents set-identity --workspace ~/.moltbot/workspace --from-identity
```

Override fields explicitly:

```bash
moltbot agents set-identity --agent main --name "MoltBot" --emoji "🦞" --avatar avatars/moltbot.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "MoltBot",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/moltbot.png",
        },
      },
    ],
  },
}
```
