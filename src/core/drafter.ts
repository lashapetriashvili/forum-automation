import type { QAItem } from "./types";

type Items = {
  question: string;
  url: string;
  matched_keywords: string[];
};

export function draftAnswer(question: string, matched: string[]): string {
  const focus = matched.length ? matched.join(", ") : "the topic";
  const brief = question.length > 140 ? question.slice(0, 140) + "…" : question;
  return `Short draft (do not post): perspective on ${focus}. Context: “${brief}”.`;
}

export function addDraftAnswer(items: Items[]): QAItem[] {
  return items.map((item) => ({
    ...item,
    drafted_answer: draftAnswer(item.question, item.matched_keywords),
    timestamp: new Date().toISOString(),
  }));
}
