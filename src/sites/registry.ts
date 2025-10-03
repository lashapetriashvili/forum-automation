import { createQuoraAdapter } from "./quora/adapter";
import type { SiteAdapter } from "./types";
import type { Driver } from "../core/driver";

export function getAdapter(name: string, driver: Driver): SiteAdapter {
  switch (name) {
    case "quora":
      return createQuoraAdapter({
        email: process.env.QUORA_EMAIL ?? "",
        password: process.env.QUORA_PASS ?? "",
        driver,
      });
    default:
      throw new Error(`Unknown site: ${name}`);
  }
}
