import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import {
  EMAIL_SEL,
  PASS_SEL,
  SUBMIT_SEL,
  SEARCH_SEL,
  QUESTION_SEL,
  normalizeText,
  topicLabel,
  hasLoginForm,
  isSubmitEnabled,
  hasQuestions,
} from "./dom";

function loadFixture(name: string): Document {
  const p = path.join(__dirname, "fixtures", name);
  const html = fs.readFileSync(p, "utf8");
  return new JSDOM(html).window.document;
}

describe("dom.ts — pure helpers", () => {
  describe("normalizeText", () => {
    it("lowercases and collapses spaces", () => {
      expect(normalizeText("  Foo   BAR  ")).toBe("foo bar");
      expect(normalizeText("FOO\nBAR\tBAZ")).toBe("foo bar baz");
      expect(normalizeText("")).toBe("");
      expect(normalizeText(null as unknown as string)).toBe("");
    });
  });

  describe("topicLabel", () => {
    it('formats as "topic: <normalized>"', () => {
      expect(topicLabel("Growth  Hacking")).toBe("topic: growth hacking");
      expect(topicLabel("  AI Startups ")).toBe("topic: ai startups");
    });
  });

  describe("hasLoginForm", () => {
    it("returns true when login form elements are present", () => {
      const doc = loadFixture("login_form.html");
      expect(hasLoginForm(EMAIL_SEL, PASS_SEL, SUBMIT_SEL, doc)).toBe(true);
    });

    it("returns false when login form elements are missing", () => {
      const doc = loadFixture("no_login_form.html");
      expect(hasLoginForm(EMAIL_SEL, PASS_SEL, SUBMIT_SEL, doc)).toBe(false);
    });
  });

  describe("isSubmitEnabled", () => {
    it("returns false when submit button is disabled", () => {
      const doc = loadFixture("login_form.html");
      expect(isSubmitEnabled(SUBMIT_SEL, doc)).toBe(false);
    });

    it("returns true when submit button is enabled", () => {
      const doc = loadFixture("login_form_enabled.html");
      expect(isSubmitEnabled(SUBMIT_SEL, doc)).toBe(true);
    });
  });

  describe("search form (fixture)", () => {
    it("contains a search input matching SEARCH_SEL", () => {
      const doc = loadFixture("search_form.html");
      const input = doc.querySelector(SEARCH_SEL);
      expect(input).not.toBeNull();
    });

    it("missing search input does not match SEARCH_SEL", () => {
      const dom = new JSDOM(`<div><input type="text" /></div>`); // no enterkeyhint="search"
      const input = dom.window.document.querySelector(SEARCH_SEL);
      expect(input).toBeNull();
    });
  });

  describe("hasQuestions", () => {
    it("false when no question nodes", () => {
      const dom = new JSDOM("<div><p>No questions here</p></div>");
      expect(hasQuestions(QUESTION_SEL, dom.window.document)).toBe(false);
    });
  });
});
