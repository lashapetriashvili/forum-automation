import type { Driver, RouteKey, Target, SiteRoutes } from "../../core/driver.js";

type Params = Record<string, string>;

const slug = (s: string) => s.trim().replace(/\s+/g, "-");

const ROUTES: Record<Driver, Record<RouteKey, (p?: Params) => Target>> = {
  hyper: {
    LOGIN: () => ({ kind: "url", url: "https://www.quora.com/login" }),
    SEARCH: () => ({ kind: "html", path: "https://www.quora.com" }),
    QUESTIONS: (p) => {
      const seed = p?.seed ?? "Growth Hacking";
      return { kind: "url", url: `https://www.quora.com/topic/${encodeURIComponent(slug(seed))}` };
    },
  },
  local: {
    LOGIN: () => ({ kind: "html", path: "src/sites/quora/fixtures/login_form_enabled.html" }),
    SEARCH: () => ({ kind: "html", path: "src/sites/quora/fixtures/search_form.html" }),
    QUESTIONS: () => ({ kind: "html", path: "src/sites/quora/fixtures/questions.html" }),
  },
};

export function createQuoraRoutes(driver: Driver): SiteRoutes {
  const table = ROUTES[driver];
  return {
    resolve(key: RouteKey, params?: Params): Target {
      const fn = table[key];
      if (!fn) throw new Error(`Unknown route key: ${key}`);
      return fn(params);
    },
  };
}
