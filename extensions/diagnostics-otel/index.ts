import type { RazroomPluginApi } from "razroom/plugin-sdk";
import { emptyPluginConfigSchema } from "razroom/plugin-sdk";
import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: RazroomPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
