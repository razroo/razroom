import type {
  AnyAgentTool,
  RazroomPluginApi,
  RazroomPluginToolFactory,
} from "../../src/plugins/types.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: RazroomPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as RazroomPluginToolFactory,
    { optional: true },
  );
}
