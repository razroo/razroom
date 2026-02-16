import type {
  AnyAgentTool,
  MoltBotPluginApi,
  MoltBotPluginToolFactory,
} from "../../src/plugins/types.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: MoltBotPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as MoltBotPluginToolFactory,
    { optional: true },
  );
}
