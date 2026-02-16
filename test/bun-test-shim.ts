/**
 * Compatibility shim: maps `bun:test` imports to vitest equivalents.
 * Used via vitest resolve alias so test files that import from "bun:test"
 * work seamlessly under both bun's native runner and vitest.
 */
import { vi } from "vitest";

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  it as test,
} from "vitest";

export { type Mock as MockInstance } from "vitest";

/**
 * bun:test `mock` serves double duty:
 *  - `mock()` / `mock(fn)` creates a mock function (vi.fn equivalent)
 *  - `mock("module", factory)` mocks a module (vi.mock equivalent)
 *
 * vitest hoists vi.mock calls so we cannot wrap it in a function.
 * Instead we attach vi.mock as a callable property and export vi.fn
 * as the default mock creator.
 */
// oxlint-disable-next-line typescript/no-explicit-any
type MockFn = ((...a: any[]) => any) & { module: typeof vi.mock };
const mock: MockFn = Object.assign(
  // oxlint-disable-next-line typescript/no-explicit-any
  (...a: any[]) => (vi.fn as any)(...a),
  { module: vi.mock.bind(vi) },
);
export { mock };

/**
 * bun:test `spyOn` is equivalent to `vi.spyOn`.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export const spyOn: any = vi.spyOn.bind(vi);
