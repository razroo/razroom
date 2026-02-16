import type { PluginRuntime } from "moltbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setIrcRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getIrcRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("IRC runtime not initialized");
  }
  return runtime;
}
