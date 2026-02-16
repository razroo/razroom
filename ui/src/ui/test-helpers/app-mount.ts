import { afterEach, beforeEach } from "vitest";
import { RazroomApp } from "../app.ts";

// oxlint-disable-next-line typescript/unbound-method
const originalConnect = RazroomApp.prototype.connect;

export function mountApp(pathname: string) {
  window.history.replaceState({}, "", pathname);
  const app = document.createElement("razroom-app") as RazroomApp;
  document.body.append(app);
  return app;
}

export function registerAppMountHooks() {
  beforeEach(() => {
    RazroomApp.prototype.connect = () => {
      // no-op: avoid real gateway WS connections in browser tests
    };
    window.__RAZROOM_CONTROL_UI_BASE_PATH__ = undefined;
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    RazroomApp.prototype.connect = originalConnect;
    window.__RAZROOM_CONTROL_UI_BASE_PATH__ = undefined;
    localStorage.clear();
    document.body.innerHTML = "";
  });
}
