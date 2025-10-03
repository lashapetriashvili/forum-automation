import type { Page } from "puppeteer-core";
import type { SiteAdapter, QuestionItem } from "../types";
import { Driver, isHyperDriver, isLocalDriver } from "../../core/driver";
import { loadTarget } from "../../core/loadTarget";
import { createQuoraRoutes } from "./routes";
import { getLogger } from "../../core/logger";
import { waitForRedirectAndReady, sleep } from "../../core/waits";

import {
  EMAIL_SEL,
  PASS_SEL,
  SUBMIT_SEL,
  SEARCH_SEL,
  SEARCH_SELECTOR_SEL,
  QUESTION_CARD_SEL,
  QUESTION_SEL,
  hasLoginForm,
  isSubmitEnabled,
  hasSearchForm,
  hasQuestions,
} from "./dom";

type Deps = {
  email: string;
  password: string;
  driver: Driver;
};

export function createQuoraAdapter(deps: Deps): SiteAdapter {
  const log = getLogger("adapter:quora");
  const routes = createQuoraRoutes(deps.driver);

  return {
    /**
     * Site name
     */
    name: "quora",

    /**
     * Capabilities supported by this adapter
     */
    capabilities: ["login", "search", "collectQuestions"],

    /**
     * Ensure the user is logged in. Returns true if logged in, false on failure.
     *
     * If already logged in, returns true immediately.
     */
    async ensureLoggedIn(page: Page): Promise<boolean> {
      await loadTarget(page, routes.resolve("LOGIN"));

      const hasForm = await page.evaluate(hasLoginForm, EMAIL_SEL, PASS_SEL, SUBMIT_SEL);
      if (!hasForm) {
        log.error(`[${this.name}] already logged in`);
        return true;
      }

      await page.waitForSelector(EMAIL_SEL, { timeout: 30_000 });
      await page.waitForSelector(PASS_SEL, { timeout: 30_000 });

      const emailHandle = await page.$(EMAIL_SEL);
      const passHandle = await page.$(PASS_SEL);
      if (!emailHandle || !passHandle) {
        log.error(`[${this.name}] login inputs not found after wait`);
        return false;
      }

      await emailHandle.type(deps.email, { delay: 40 });
      await passHandle.type(deps.password, { delay: 40 });

      try {
        await page.waitForFunction(isSubmitEnabled, { timeout: 5_000 }, SUBMIT_SEL);
      } catch {
        log.error(`[${this.name}] submit button did not enable (timeout)`);
        return false;
      }

      const tasks: Promise<void>[] = [page.click(SUBMIT_SEL)];

      if (isHyperDriver(deps.driver)) {
        const navPromise: Promise<void> = page
          .waitForNavigation({ waitUntil: "networkidle2", timeout: 60_000 })
          .then(() => {})
          .catch(() => {
            log.error(`[${this.name}] navigation after login did not occur (continuing)`);
          });
        tasks.push(navPromise);
      }

      await Promise.allSettled(tasks);

      if (isLocalDriver(deps.driver)) {
        log.warn(`[${this.name}] local driver: skipping post-login DOM check`);
        return true;
      }

      const stillHasForm = await page.evaluate(hasLoginForm, EMAIL_SEL, PASS_SEL, SUBMIT_SEL);
      const ok = !stillHasForm;

      if (!ok) {
        log.error(`[${this.name}] login form still present after submit`);
      }
      return ok;
    },

    /**
     * Perform a search for the given topic.
     * Returns true if search was performed, false on failure.
     */
    async search(page: Page, topic: string): Promise<boolean> {
      // await loadTarget(page, routes.resolve("SEARCH"));

      const hasForm = await page
        .waitForFunction(hasSearchForm, { timeout: 30_000 }, SEARCH_SEL)
        .catch(() => false);

      if (!hasForm) {
        log.error(`[${this.name}] search form not found`);
        return false;
      }

      await page.waitForSelector(SEARCH_SEL, { timeout: 30_000, visible: true });
      const searchHandle = await page.$(SEARCH_SEL);
      if (!searchHandle) {
        log.error(`[${this.name}] search input handle missing`);
        return false;
      }
      await searchHandle.click({ clickCount: 1 });
      await searchHandle.type(topic, { delay: 40 });

      const ok = await page
        .waitForFunction(
          (sel) => document.querySelectorAll(sel).length > 0,
          { timeout: 10_000, polling: 100 },
          SEARCH_SELECTOR_SEL
        )
        .then(() => true)
        .catch(() => false);

      if (!ok) {
        log.warn(`[${this.name}] no suggestions appeared for "${topic}"`);
        return true;
      }

      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const target = norm(`Topic: ${topic}`);

      const els = await page.$$(SEARCH_SELECTOR_SEL);

      let clicked = false;
      for (const el of els) {
        const text = await el.evaluate((node) =>
          (node.textContent || "").replace(/\s+/g, " ").toLowerCase().trim()
        );

        if (text === target) {
          await el.evaluate((node) => node.scrollIntoView({ block: "center", inline: "center" }));

          try {
            await el.click({ delay: 20 });
          } catch {
            await el.evaluate((node) =>
              node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
            );
          }
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        console.warn(`[quora] Topic suggestion not found for "${topic}"`);
      } else {
        await waitForRedirectAndReady(page, {
          timeout: 10_000,
        });
      }

      return true;
    },

    /**
     * Collect question items from the current topic page, up to the specified limit.
     * Returns an array of QuestionItem objects.
     * If no questions are found or an error occurs, returns an empty array.
     */
    async collectQuestions(page: Page, topic: string, limit: number): Promise<QuestionItem[]> {
      const results: QuestionItem[] = [];
      const seen = new Set<string>();

      // await loadTarget(page, routes.resolve("QUESTIONS"));

      const hasList = await page
        .waitForFunction(hasQuestions, { timeout: 30_000 }, QUESTION_SEL)
        .catch(() => false);

      if (!hasList) {
        log.error(`[${this.name}] question list not found`);
        return [];
      }

      let lastCount = -1;

      while (results.length < limit) {
        const clicked = await page.$$eval(QUESTION_CARD_SEL, (els) => {
          let c = 0;
          for (const el of els) {
            const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
            if (txt === "(more)") {
              (el as HTMLElement).dispatchEvent(
                new MouseEvent("click", { bubbles: true, cancelable: true })
              );
              c++;
            }
          }
          return c;
        });
        if (clicked) await sleep(1_000);

        const batch = await page.$$eval(QUESTION_SEL, (els) => {
          const out: { question: string; url: string }[] = [];
          for (const el of els) {
            const titleNode =
              el.querySelector(".qu-userSelect--text") ||
              el.querySelector(".puppeteer_test_question_title") ||
              el.querySelector('[data-test-id="question_link"]');

            const question = (el.textContent || "").replace(/\s+/g, " ").trim();

            const a =
              (titleNode &&
                (titleNode.closest("a") ||
                  (titleNode.querySelector && titleNode.querySelector("a")))) ||
              el.querySelector('a[href^="https://www.quora.com/"]');

            const url = a ? (a as HTMLAnchorElement).href : "";

            if (question && url) out.push({ question, url });
          }
          return out;
        });

        for (const { question, url } of batch) {
          if (results.length >= limit) break;
          if (seen.has(url)) continue;
          seen.add(url);
          results.push({ question, url, matched_keywords: [topic] });
        }

        if (results.length >= limit) break;

        if (results.length === lastCount) {
          await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.9)));
          await sleep(400);

          const after = results.length;
          const more = await page.$$eval(QUESTION_SEL, (els) => els.length);
          if (results.length === after && more === 0) break;
        } else {
          lastCount = results.length;
        }

        await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.9)));
        await sleep(300);
      }

      return results.slice(0, limit);
    },
  };
}
