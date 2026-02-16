import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  getDiagnosticSessionStateCountForTest,
  getDiagnosticSessionState,
  resetDiagnosticSessionStateForTest,
} from "./diagnostic-session-state.js";

describe("diagnostic session state pruning", () => {
  beforeEach(() => {
    // TODO: Implement fake timers for Bun;
    resetDiagnosticSessionStateForTest();
  });

  afterEach(() => {
    resetDiagnosticSessionStateForTest();
    // TODO: Restore real timers;
  });

  it("evicts stale idle session states", () => {
    getDiagnosticSessionState({ sessionId: "stale-1" });
    expect(getDiagnosticSessionStateCountForTest()).toBe(1);

    // TODO: Advance timers(31 * 60 * 1000);
    getDiagnosticSessionState({ sessionId: "fresh-1" });

    expect(getDiagnosticSessionStateCountForTest()).toBe(1);
  });

  it("caps tracked session states to a bounded max", () => {
    for (let i = 0; i < 2001; i += 1) {
      getDiagnosticSessionState({ sessionId: `session-${i}` });
    }

    expect(getDiagnosticSessionStateCountForTest()).toBe(2000);
  });
});
