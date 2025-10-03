import type { Page } from "puppeteer-core";

export type QAItem = {
  question: string;
  url: string;
  matched_keywords: string[];
  drafted_answer: string;
  timestamp: string;
};

export interface SiteAdapter {
  name: string;
  ensureLoggedIn(page: Page): Promise<boolean>;
  navigateToSeed(page: Page, seed: string): Promise<void>;
  collectQuestions(page: Page, limit: number): Promise<Array<{ question: string; url: string }>>;
}

export interface HyperbrowserSessionClient {
  sessions: {
    stop(id: string): Promise<unknown>;
  };
}
