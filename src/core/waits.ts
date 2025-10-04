import type { Page } from "puppeteer-core";

export const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export async function waitForRedirectAndReady(
  page: Page,
  opts: { timeout?: number; readySelectors?: string[] } = {}
) {
  const timeout = opts.timeout ?? 10_000;
  const startUrl = page.url();

  await Promise.race([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout }).catch(() => {}),
    page
      .waitForFunction((prev) => location.href !== prev, { timeout, polling: 100 }, startUrl)
      .catch(() => {}),
  ]);

  if (opts.readySelectors?.length) {
    for (const sel of opts.readySelectors) {
      try {
        await page.waitForSelector(sel, {
          timeout: Math.max(1000, Math.floor(timeout / opts.readySelectors.length)),
          visible: true,
        });
        return;
      } catch {
        console.warn(`Selector "${sel}" not found (continuing)`);
      }
    }
  }

  try {
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 5000 });
  } catch {
    console.warn("readyState did not reach 'complete' (continuing)");
  }
}
