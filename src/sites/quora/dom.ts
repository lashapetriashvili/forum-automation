import type { Page } from "puppeteer-core";

export const EMAIL_SEL = 'input[name="email"], input[type="email"]';
export const PASS_SEL = 'input[name="password"][type="password"], input[type="password"]';
export const SUBMIT_SEL = 'button[type="button"], input[type="submit"], button[type="submit"]';
export const SEARCH_SEL = 'input[type="text"][enterkeyhint="search"]';
export const SEARCH_SELECTOR_SEL = ".q-box .puppeteer_test_selector_result";
export const QUESTION_CARD_SEL = ".qu-mt--small .qu-pl--tiny";
export const QUESTION_SEL = ".qu-mt--small .qu-mb--tiny";

/** ---------- Small, pure helpers ---------- */

export function normalizeText(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function topicLabel(topic: string): string {
  return `topic: ${normalizeText(topic)}`;
}

/** ---------- Presence checks used by adapter ---------- */

/**
 * Check if the login form is present in the document
 *
 * @param emailSel Selector for the email input
 * @param passSel Selector for the password input
 * @param submitSel Selector for the submit button
 * @param doc Optional Document to check (defaults to global document)
 *
 * @returns true if all elements are present, false otherwise
 */
export function hasLoginForm(
  emailSel: string,
  passSel: string,
  submitSel: string,
  doc?: Document
): boolean {
  const d = doc ?? document;
  return !!(d.querySelector(emailSel) && d.querySelector(passSel) && d.querySelector(submitSel));
}

/**
 * Check if the search form is present in the document
 *
 * @param searchSel Selector for the search input
 * @param doc Optional Document to check (defaults to global document)
 *
 * @returns true if the search input is present, false otherwise
 */
export function isSubmitEnabled(submitSel: string, doc?: Document): boolean {
  const d = doc ?? document;
  const btn = d.querySelector(submitSel) as HTMLButtonElement | HTMLInputElement | null;
  if (!btn) return false;
  const aria = btn.getAttribute("aria-disabled");
  return !btn.disabled && aria !== "true";
}

/**
 * Check if the search form is present in the document
 * @param searchSel Selector for the search input
 * @param doc Optional Document to check (defaults to global document)
 * @returns true if the search input is present, false otherwise
 */
export function hasQuestions(questionSel: string, doc?: Document): boolean {
  const d = doc ?? document;
  return !!d.querySelector(questionSel);
}

/** ---------- Page helpers that accept Page (safe evaluate) ---------- */

/**
 * Wait until the search form is present on the page
 *
 * @param page Puppeteer Page
 * @param searchSel Selector for the search input
 * @param timeout Timeout in ms (default 30s)
 *
 * @returns true if found, false if timeout
 */
export async function ensureSearchFormPresent(
  page: Page,
  searchSel: string,
  timeout = 30_000
): Promise<boolean> {
  return page
    .waitForFunction((sel: string) => !!document.querySelector(sel), { timeout }, searchSel)
    .then(() => true)
    .catch(() => false);
}

/**
 * Focus and type into an input field
 *
 * @param page Puppeteer Page
 * @param inputSel Selector for the input field
 * @param text Text to type
 *
 * @returns true if input found and typed, false if not found
 */
export async function focusAndType(page: Page, inputSel: string, text: string): Promise<boolean> {
  await page.waitForSelector(inputSel, { timeout: 30_000, visible: true });
  const el = await page.$(inputSel);
  if (!el) return false;
  await el.click({ clickCount: 1 });
  await el.type(text, { delay: 40 });
  return true;
}

/**
 * Wait until at least one suggestion element is present on the page
 *
 * @param page Puppeteer Page
 * @param sel Selector for the suggestion elements
 * @param timeout Timeout in ms (default 10s)
 *
 * @returns true if found, false if timeout
 */
export async function suggestionsReady(
  page: Page,
  sel: string,
  timeout = 10_000
): Promise<boolean> {
  return page
    .waitForFunction(
      (s: string) => document.querySelectorAll(s).length > 0,
      { timeout, polling: 100 },
      sel
    )
    .then(() => true)
    .catch(() => false);
}

/**
 * Click the exact 'Topic: <topic>' suggestion on the page
 *
 * @param page Puppeteer Page
 * @param sel Selector for the suggestion elements
 * @param wantLabel The exact label to match (e.g. "topic: growth hacking")
 *
 * @returns true if clicked, false if not found
 */
export async function clickTopicSuggestionInPage(
  page: Page,
  sel: string,
  wantLabel: string
): Promise<boolean> {
  let clicked = false;
  const els = await page.$(sel).then(() => page.$$(sel)); // ensure query, then list
  for (const el of els) {
    const text = await el.evaluate((node) =>
      (node.textContent || "").toLowerCase().replace(/\s+/g, " ").trim()
    );
    if (text === wantLabel) {
      try {
        const box = await el.boundingBox();
        if (box) {
          await el.evaluate((node) =>
            (node as HTMLElement).scrollIntoView({ block: "center", inline: "center" })
          );
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.up();
        } else {
          await el.click({ delay: 20 });
        }
        clicked = true;
      } catch {
        await el.evaluate((node) => {
          const target = node as HTMLElement;
          target.scrollIntoView({ block: "center", inline: "center" });
          const mk = (type: string) =>
            new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
          target.dispatchEvent(mk("pointerdown"));
          target.dispatchEvent(mk("mousedown"));
          target.dispatchEvent(mk("mouseup"));
          target.dispatchEvent(mk("click"));
        });
        clicked = true;
      }
      break;
    }
  }

  return clicked;
}

/**
 * On the current page, find the first element matching `sel` whose text matches `wantLabel`
 * (case-insensitive, whitespace normalized), then return the href of the nearest/first <a>.
 *
 * @param page Puppeteer Page
 * @param sel Selector for the elements to search
 * @param wantLabel The exact label to match (e.g. "topic: growth hacking")
 *
 * @returns href string if found, or null if not found
 */
export async function resolveTopicHrefOnPage(
  page: Page,
  sel: string,
  wantLabel: string
): Promise<string | null> {
  return page.evaluate(
    (s: string, want: string) => {
      const nodes = Array.from(document.querySelectorAll(s));
      for (const n of nodes) {
        const text = (n.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        if (text === want) {
          const a =
            (n.closest("a") as HTMLAnchorElement | null) ||
            (n.querySelector && (n.querySelector("a") as HTMLAnchorElement | null)) ||
            null;
          return a?.href ?? null;
        }
      }
      return null;
    },
    sel,
    wantLabel
  );
}

/**
 * On the current page, find and click all "(more)" toggles within elements matching `cardSel`.
 * This is used to expand truncated question texts.
 *
 * @param page Puppeteer Page
 * @param cardSel Selector for the question card elements
 *
 * @returns number of toggles clicked
 */
export async function expandMoreToggles(page: Page, cardSel: string): Promise<number> {
  return page.evaluate((sel: string) => {
    let c = 0;
    const els = Array.from(document.querySelectorAll(sel));
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
  }, cardSel);
}

export type RawQuestion = { question: string; url: string };

/**
 * On the current page, extract question text and URL from elements matching `itemSel`.
 *
 * @param page Puppeteer Page
 * @param itemSel Selector for the question item elements
 *
 * @returns array of { question, url } objects
 */
export async function extractQuestionBatchOnPage(
  page: Page,
  itemSel: string
): Promise<RawQuestion[]> {
  return page.evaluate((sel: string) => {
    const out: { question: string; url: string }[] = [];
    const items = Array.from(document.querySelectorAll(sel));
    for (const el of items) {
      const titleNode =
        el.querySelector(".qu-userSelect--text") ||
        el.querySelector(".puppeteer_test_question_title") ||
        el.querySelector('[data-test-id="question_link"]');

      const question = (el.textContent || "").replace(/\s+/g, " ").trim();

      const a =
        (titleNode &&
          (titleNode.closest("a") ||
            ((titleNode as Element).querySelector && (titleNode as Element).querySelector("a")))) ||
        el.querySelector('a[href^="https://www.quora.com/"]');

      const url = a ? (a as HTMLAnchorElement).href : "";
      if (question && url) out.push({ question, url });
    }
    return out;
  }, itemSel);
}
