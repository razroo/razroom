/**
 * Runtime detection utilities for Bun vs Node.js
 */

/**
 * Check if running on Bun runtime
 */
export function isBun(): boolean {
  return typeof (process.versions as { bun?: unknown }).bun === "string";
}

/**
 * Check if running on Node.js runtime
 */
export function isNode(): boolean {
  return typeof process.versions?.node === "string" && !isBun();
}

/**
 * Get the runtime name as a string
 */
export function getRuntimeName(): "bun" | "node" | "unknown" {
  if (isBun()) {
    return "bun";
  }
  if (isNode()) {
    return "node";
  }
  return "unknown";
}

/**
 * Get the runtime version
 */
export function getRuntimeVersion(): string | null {
  const versions = process.versions as { bun?: string; node?: string };
  if (isBun()) {
    return versions.bun ?? null;
  }
  if (isNode()) {
    return versions.node ?? null;
  }
  return null;
}
