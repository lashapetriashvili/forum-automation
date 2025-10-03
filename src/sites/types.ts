import type { Page } from "puppeteer-core";

export type Capability =
  | "login"
  | "search"
  | "collectQuestions"
  | "navigateSeed"
  | "draftAnswer"
  | "draftComment";

export type QuestionItem = { question: string; url: string; matched_keywords: string[] };
export type PostItem = { title: string; url: string };
export type ThreadItem = { title: string; url: string };

export interface SiteAdapter {
  name: string;
  capabilities: Capability[];

  ensureLoggedIn?(page: Page): Promise<boolean>;
  search?(page: Page, topic: string): Promise<boolean>;
  collectQuestions?(page: Page, topic: string, limit: number): Promise<QuestionItem[]>;
  navigateToSeed?(page: Page, seed: string): Promise<void>;
  draftAnswer?(q: string, matchedKeywords: string[]): Promise<string>;
  draftComment?(text: string, context?: Record<string, unknown>): Promise<string>;
}
