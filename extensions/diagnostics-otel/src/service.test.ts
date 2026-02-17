import { beforeEach, describe, expect, test, mock, spyOn } from "bun:test";

const registerLogTransportMock = vi.hoisted(() => mock());

const telemetryState = vi.hoisted(() => {
  const counters = new Map<string, { add: ReturnType<typeof mock> }>();
  const histograms = new Map<string, { record: ReturnType<typeof mock> }>();
  const tracer = {
    startSpan: mock((_name: string, _opts?: unknown) => ({
      end: mock(),
      setStatus: mock(),
    })),
  };
  const meter = {
    createCounter: mock((name: string) => {
      const counter = { add: mock() };
      counters.set(name, counter);
      return counter;
    }),
    createHistogram: mock((name: string) => {
      const histogram = { record: mock() };
      histograms.set(name, histogram);
      return histogram;
    }),
  };
  return { counters, histograms, tracer, meter };
});

const sdkStart = vi.hoisted(() => mock().mockResolvedValue(undefined));
const sdkShutdown = vi.hoisted(() => mock().mockResolvedValue(undefined));
const logEmit = vi.hoisted(() => mock());
const logShutdown = vi.hoisted(() => mock().mockResolvedValue(undefined));

mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => telemetryState.meter,
  },
  trace: {
    getTracer: () => telemetryState.tracer,
  },
  SpanStatusCode: {
    ERROR: 2,
  },
}));

mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    start = sdkStart;
    shutdown = sdkShutdown;
  },
}));

mock("@opentelemetry/exporter-metrics-otlp-http", () => ({
  OTLPMetricExporter: class {},
}));

mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {},
}));

mock("@opentelemetry/exporter-logs-otlp-http", () => ({
  OTLPLogExporter: class {},
}));

mock("@opentelemetry/sdk-logs", () => ({
  BatchLogRecordProcessor: class {},
  LoggerProvider: class {
    addLogRecordProcessor = mock();
    getLogger = mock(() => ({
      emit: logEmit,
    }));
    shutdown = logShutdown;
  },
}));

mock("@opentelemetry/sdk-metrics", () => ({
  PeriodicExportingMetricReader: class {},
}));

mock("@opentelemetry/sdk-trace-base", () => ({
  ParentBasedSampler: class {},
  TraceIdRatioBasedSampler: class {},
}));

mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: mock((attrs: Record<string, unknown>) => attrs),
  Resource: class {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(_value?: unknown) {}
  },
}));

mock("@opentelemetry/semantic-conventions", () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: "service.name",
  },
}));

mock("razroom/plugin-sdk", async () => {
  const actual = await vi.importActual<typeof import("razroom/plugin-sdk")>("razroom/plugin-sdk");
  return {
    ...actual,
    registerLogTransport: registerLogTransportMock,
  };
});

import { emitDiagnosticEvent } from "@razroo/razroom/plugin-sdk";
import { createDiagnosticsOtelService } from "./service.js";

describe("diagnostics-otel service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telemetryState.counters.clear();
    telemetryState.histograms.clear();
  });

  test("records message-flow metrics and spans", async () => {
    const registeredTransports: Array<(logObj: Record<string, unknown>) => void> = [];
    const stopTransport = mock();
    registerLogTransportMock.mockImplementation((transport) => {
      registeredTransports.push(transport);
      return stopTransport;
    });

    const service = createDiagnosticsOtelService();
    await service.start({
      config: {
        diagnostics: {
          enabled: true,
          otel: {
            enabled: true,
            endpoint: "http://otel-collector:4318",
            protocol: "http/protobuf",
            traces: true,
            metrics: true,
            logs: true,
          },
        },
      },
      logger: {
        info: mock(),
        warn: mock(),
        error: mock(),
        debug: mock(),
      },
    });

    emitDiagnosticEvent({
      type: "webhook.received",
      channel: "telegram",
      updateType: "telegram-post",
    });
    emitDiagnosticEvent({
      type: "webhook.processed",
      channel: "telegram",
      updateType: "telegram-post",
      durationMs: 120,
    });
    emitDiagnosticEvent({
      type: "message.queued",
      channel: "telegram",
      source: "telegram",
      queueDepth: 2,
    });
    emitDiagnosticEvent({
      type: "message.processed",
      channel: "telegram",
      outcome: "completed",
      durationMs: 55,
    });
    emitDiagnosticEvent({
      type: "queue.lane.dequeue",
      lane: "main",
      queueSize: 3,
      waitMs: 10,
    });
    emitDiagnosticEvent({
      type: "session.stuck",
      state: "processing",
      ageMs: 125_000,
    });
    emitDiagnosticEvent({
      type: "run.attempt",
      runId: "run-1",
      attempt: 2,
    });

    expect(telemetryState.counters.get("razroom.webhook.received")?.add).toHaveBeenCalled();
    expect(telemetryState.histograms.get("razroom.webhook.duration_ms")?.record).toHaveBeenCalled();
    expect(telemetryState.counters.get("razroom.message.queued")?.add).toHaveBeenCalled();
    expect(telemetryState.counters.get("razroom.message.processed")?.add).toHaveBeenCalled();
    expect(telemetryState.histograms.get("razroom.message.duration_ms")?.record).toHaveBeenCalled();
    expect(telemetryState.histograms.get("razroom.queue.wait_ms")?.record).toHaveBeenCalled();
    expect(telemetryState.counters.get("razroom.session.stuck")?.add).toHaveBeenCalled();
    expect(
      telemetryState.histograms.get("razroom.session.stuck_age_ms")?.record,
    ).toHaveBeenCalled();
    expect(telemetryState.counters.get("razroom.run.attempt")?.add).toHaveBeenCalled();

    const spanNames = telemetryState.tracer.startSpan.mock.calls.map((call) => call[0]);
    expect(spanNames).toContain("razroom.webhook.processed");
    expect(spanNames).toContain("razroom.message.processed");
    expect(spanNames).toContain("razroom.session.stuck");

    expect(registerLogTransportMock).toHaveBeenCalledTimes(1);
    expect(registeredTransports).toHaveLength(1);
    registeredTransports[0]?.({
      0: '{"subsystem":"diagnostic"}',
      1: "hello",
      _meta: { logLevelName: "INFO", date: new Date() },
    });
    expect(logEmit).toHaveBeenCalled();

    await service.stop?.();
  });
});
