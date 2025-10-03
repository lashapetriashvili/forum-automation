import fs from "fs";
import type { Page } from "puppeteer-core";
import type { Target } from "./driver";

export async function loadTarget(page: Page, target: Target) {
  if (target.kind === "url") {
    await page.goto(target.url, { waitUntil: "domcontentloaded" });
  } else {
    const html = fs.readFileSync(target.path, "utf8");
    await page.setContent(html, { waitUntil: "domcontentloaded" });
  }
}
