export type Driver = "local" | "hyper";

export type RouteKey = "LOGIN" | "SEARCH" | "QUESTIONS";

export type Target = { kind: "url"; url: string } | { kind: "html"; path: string };

export interface SiteRoutes {
  resolve(key: RouteKey, params?: Record<string, string>): Target;
}

export function isLocalDriver(driver: Driver): boolean {
  return driver === "local";
}

export function isHyperDriver(driver: Driver): boolean {
  return driver === "hyper";
}
