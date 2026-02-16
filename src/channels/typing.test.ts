import { describe, expect, it, mock, spyOn } from "bun:test";
import { createTypingCallbacks } from "./typing.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createTypingCallbacks", () => {
  it("invokes start on reply start", async () => {
    const start = mock().mockResolvedValue(undefined);
    const onStartError = mock();
    const callbacks = createTypingCallbacks({ start, onStartError });

    await callbacks.onReplyStart();

    expect(start).toHaveBeenCalledTimes(1);
    expect(onStartError).not.toHaveBeenCalled();
  });

  it("reports start errors", async () => {
    const start = mock().mockRejectedValue(new Error("fail"));
    const onStartError = mock();
    const callbacks = createTypingCallbacks({ start, onStartError });

    await callbacks.onReplyStart();

    expect(onStartError).toHaveBeenCalledTimes(1);
  });

  it("invokes stop on idle and reports stop errors", async () => {
    const start = mock().mockResolvedValue(undefined);
    const stop = mock().mockRejectedValue(new Error("stop"));
    const onStartError = mock();
    const onStopError = mock();
    const callbacks = createTypingCallbacks({ start, stop, onStartError, onStopError });

    callbacks.onIdle?.();
    await flush();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(onStopError).toHaveBeenCalledTimes(1);
  });
});
