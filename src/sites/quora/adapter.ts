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
  ensureSearchFormPresent,
  focusAndType,
  suggestionsReady,
  clickTopicSuggestionInPage,
  resolveTopicHrefOnPage,
  hasQuestions,
  topicLabel,
  expandMoreToggles,
  extractQuestionBatchOnPage,
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
     * Site identifier name
     */
    name: "quora",

    /**
     * Site capabilities
     * - login: can log in
     * - search: can search for topics
     * - collectQuestions: can collect questions for a topic
     */
    capabilities: ["login", "search", "collectQuestions"],

    /**
     * Ensure the user is logged in
     *
     * @param page Puppeteer Page instance
     * @returns true if logged in or login succeeded, false otherwise
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
        tasks.push(
          page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 60_000 })
            .then(() => {})
            .catch(() => {
              log.error(`[${this.name}] navigation after login did not occur (continuing)`);
            })
        );
      }

      await Promise.allSettled(tasks);

      if (isLocalDriver(deps.driver)) {
        log.warn(`[${this.name}] local driver: skipping post-login DOM check`);
        return true;
      }

      const stillHasForm = await page.evaluate(hasLoginForm, EMAIL_SEL, PASS_SEL, SUBMIT_SEL);
      const ok = !stillHasForm;
      if (!ok) log.error(`[${this.name}] login form still present after submit`);
      return ok;
    },

    /**
     * Search for a topic and navigate to its page
     * @param page Puppeteer Page instance
     * @param topic Topic name to search for
     * @returns true if search was performed (even if topic not found), false on error
     */
    async search(page: Page, topic: string): Promise<boolean> {
      // await loadTarget(page, routes.resolve("SEARCH"));

      const want = topicLabel(topic);

      const okForm = await ensureSearchFormPresent(page, SEARCH_SEL, 30_000);
      if (!okForm) {
        log.error(`[${this.name}] search form not found`);
        return false;
      }

      const typed = await focusAndType(page, SEARCH_SEL, topic);
      if (!typed) {
        log.error(`[${this.name}] search input handle missing`);
        return false;
      }

      const ready = await suggestionsReady(page, SEARCH_SELECTOR_SEL, 10_000);
      if (!ready) {
        log.warn(`[${this.name}] no suggestions appeared for "${topic}"`);
        return true; // best-effort
      }

      let clicked = await clickTopicSuggestionInPage(page, SEARCH_SELECTOR_SEL, want);

      if (!clicked) {
        try {
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          clicked = true;
        } catch {
          // ignore
        }
      }

      if (!clicked) {
        const href = await resolveTopicHrefOnPage(page, SEARCH_SELECTOR_SEL, want);
        if (href) {
          await Promise.allSettled([
            page
              .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 })
              .catch(() => {}),
            page.goto(href, { waitUntil: "domcontentloaded" }),
          ]);
          clicked = true;
        }
      }

      if (clicked) {
        await waitForRedirectAndReady(page, { timeout: 10_000 });
      } else {
        log.warn(
          `[${this.name}] Topic suggestion not found for "${topic}" (want label: "${want}")`
        );
      }

      return true;
    },

    /**
     * Collect question items for a given topic
     *
     * @param page Puppeteer Page instance
     * @param topic Topic name (for metadata only)
     * @param limit Maximum number of questions to collect
     * @returns Array of question items (may be empty)
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
        const clicked = await expandMoreToggles(page, QUESTION_CARD_SEL);
        if (clicked) await sleep(1_000);

        const batch = await extractQuestionBatchOnPage(page, QUESTION_SEL);

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
          const moreCount = await page.$$eval(QUESTION_SEL, (els) => els.length);
          if (results.length === lastCount && moreCount === 0) break;
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
