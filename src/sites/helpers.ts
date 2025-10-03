import type { SiteAdapter, Capability } from "./types";

export function hasCapability(adapter: SiteAdapter, cap: Capability): boolean {
  return adapter.capabilities.includes(cap);
}

export function requireCaps(adapter: SiteAdapter, ...caps: Capability[]) {
  const missing = caps.filter((c) => !hasCapability(adapter, c));
  if (missing.length) {
    throw new Error(`[${adapter.name}] missing capabilities: ${missing.join(", ")}`);
  }
}
