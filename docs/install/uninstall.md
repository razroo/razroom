---
summary: "Uninstall Razroom completely (CLI, service, state, workspace)"
read_when:
  - You want to remove Razroom from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `razroom` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
razroom uninstall
```

Non-interactive (automation / npx):

```bash
razroom uninstall --all --yes --non-interactive
npx -y razroom uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
razroom gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
razroom gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${RAZROOM_STATE_DIR:-$HOME/.razroom}"
```

If you set `RAZROOM_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.razroom/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g razroom
pnpm remove -g razroom
bun remove -g razroom
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/Razroom.app
```

Notes:

- If you used profiles (`--profile` / `RAZROOM_PROFILE`), repeat step 3 for each state dir (defaults are `~/.razroom-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `razroom` is missing.

### macOS (launchd)

Default label is `bot.molt.gateway` (or `bot.molt.<profile>`; legacy `com.razroom.*` may still exist):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

If you used a profile, replace the label and plist name with `bot.molt.<profile>`. Remove any legacy `com.razroom.*` plists if present.

### Linux (systemd user unit)

Default unit name is `razroom-gateway.service` (or `razroom-gateway-<profile>.service`):

```bash
systemctl --user disable --now razroom-gateway.service
rm -f ~/.config/systemd/user/razroom-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `Razroom Gateway` (or `Razroom Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "Razroom Gateway"
Remove-Item -Force "$env:USERPROFILE\.razroom\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.razroom-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://razroom.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g @razroo/razroom@latest`.
Remove it with `npm rm -g razroom` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `razroom ...` / `bun run razroom ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
