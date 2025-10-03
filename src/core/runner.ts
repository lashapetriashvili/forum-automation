import type { Page } from "puppeteer-core";
import type { SiteAdapter } from "../sites/types";
import { getLogger } from "./logger";
import { hasCapability } from "../sites/helpers";

const logger = getLogger("runner");

export async function runWorkflow(
  adapter: SiteAdapter,
  page: Page,
  opts: { topic: string; limit: number }
) {
  if (hasCapability(adapter, "login") && adapter.ensureLoggedIn) {
    const ok = await adapter.ensureLoggedIn(page);

    if (!ok) {
      const msg = `[${adapter.name}] login failed`;
      logger.error(msg);
      throw new Error(msg);
    }
  }

  if (hasCapability(adapter, "search") && adapter.search) {
    await adapter.search(page, opts.topic);
  }

  if (hasCapability(adapter, "collectQuestions") && adapter.collectQuestions) {
    return await adapter.collectQuestions(page, opts.topic, opts.limit);
  }

  return null;
}
