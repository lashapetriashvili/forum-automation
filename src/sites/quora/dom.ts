export const EMAIL_SEL = 'input[name="email"], input[type="email"]';
export const PASS_SEL = 'input[name="password"][type="password"], input[type="password"]';
export const SUBMIT_SEL = 'button[type="button"], input[type="submit"], button[type="submit"]';
export const SEARCH_SEL = 'input[type="text"][enterkeyhint="search"]';
export const SEARCH_SELECTOR_SEL = ".q-box .puppeteer_test_selector_result";
export const QUESTION_CARD_SEL = ".qu-mt--small .qu-pl--tiny";
export const QUESTION_SEL = ".qu-mt--small .qu-mb--tiny";

export function hasLoginForm(
  emailSel: string,
  passSel: string,
  submitSel: string,
  doc?: Document
): boolean {
  const d = doc ?? document;
  return !!(d.querySelector(emailSel) && d.querySelector(passSel) && d.querySelector(submitSel));
}

export function isSubmitEnabled(submitSel: string, doc?: Document): boolean {
  const d = doc ?? document;
  const btn = d.querySelector(submitSel) as HTMLButtonElement | HTMLInputElement | null;
  if (!btn) return false;
  const aria = btn.getAttribute("aria-disabled");
  return !btn.disabled && aria !== "true";
}

export function hasSearchForm(searchSel: string, doc?: Document): boolean {
  const d = doc ?? document;
  return !!d.querySelector(searchSel);
}

export function hasQuestions(questionSel: string, doc?: Document): boolean {
  const d = doc ?? document;
  return !!d.querySelector(questionSel);
}
