import { afterEach, beforeEach } from "vitest";
import { MoltBotApp } from "../app.ts";

// oxlint-disable-next-line typescript/unbound-method
const originalConnect = MoltBotApp.prototype.connect;

export function mountApp(pathname: string) {
  window.history.replaceState({}, "", pathname);
  const app = document.createElement("moltbot-app") as MoltBotApp;
  document.body.append(app);
  return app;
}

export function registerAppMountHooks() {
  beforeEach(() => {
    MoltBotApp.prototype.connect = () => {
      // no-op: avoid real gateway WS connections in browser tests
    };
    window.__MOLTBOT_CONTROL_UI_BASE_PATH__ = undefined;
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    MoltBotApp.prototype.connect = originalConnect;
    window.__MOLTBOT_CONTROL_UI_BASE_PATH__ = undefined;
    localStorage.clear();
    document.body.innerHTML = "";
  });
}
