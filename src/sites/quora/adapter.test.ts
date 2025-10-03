import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { EMAIL_SEL, PASS_SEL, SUBMIT_SEL, hasLoginForm, isSubmitEnabled } from "./dom";

function loadFixture(name: string): Document {
  const p = path.join(__dirname, "fixtures", name);
  const html = fs.readFileSync(p, "utf8");
  return new JSDOM(html).window.document;
}

describe("Quora DOM helpers", () => {
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
});
