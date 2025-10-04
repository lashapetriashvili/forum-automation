# Astral Quora Workflow

> 🧠 A fully automated, **headed Hyperbrowser + Puppeteer** workflow that logs into **Quora**, navigates to a **topic**, collects the first **N questions**, drafts **local-only answers**, and exports structured **JSON/CSV** data — all while handling basic anti-bot measures with logging, retries, and modular design.

---

## 📚 Navigation

- [Local Development Mode (Fixtures) vs. Hyperbrowser](#local-development-mode-fixtures-vs-hyperbrowser)
- [Project Structure](#project-structure)
- [What It Does](#what-it-does)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [How It Works (Architecture)](#how-it-works-architecture)
- [Anti-Bot & Reliability](#anti-bot--reliability)
- [Output Schema](#output-schema)
- [Testing](#testing)
- [Samples and Logs](#samples-and-logs)
- [Commands](#commands)

---

## 🧪 Local Development Mode (Fixtures) vs. Hyperbrowser

> **TL;DR**: Use `--driver local` to run the workflow entirely **offline** against HTML fixtures. It’s **fast**, **safe**, and **cost-effective** — no Hyperbrowser session required.

### Why Local Mode?
- 🛡 **Safe** – No live Quora interaction; zero risk of bans or content modification.
- ⚡ **Fast** – Instant DOM loads without waiting for Hyperbrowser sessions.
- 💰 **Cost-effective** – No Hyperbrowser minutes or proxy usage during iteration.
- 🧪 **Deterministic** – Repeatable tests using static HTML snapshots.
- ✅ **Additional plus — TDD-ready**: The codebase is structured for **test‑driven development**. Write unit tests first (selectors, DOM predicates, parsing), run them locally on fixtures, and only then validate on Hyperbrowser.

### Test‑Driven Workflow (recommended)
1. **Write/Update tests** in `src/sites/quora/dom.test.ts` (or add new ones).
2. **Run tests locally** (fixtures via JSDOM): `npm test`.
3. **Iterate** on selectors/logic until tests pass deterministically.
4. **Smoke test** end‑to‑end in **local driver** (fixtures):
```bash
npm run scraper

# or

npm run scraper -- \
  --driver local \
  --site quora \
  --topic "Growth Hacking" \
  --limit 10 \
```

5. **Verify live** on **Hyperbrowser** with proxy (headed):
```bash
npm run scraper -- \
  --driver hyper \
  --site quora \
  --topic "Growth Hacking" \
  --limit 10 \
  --outdir output \
  --proxy-host "$PROXY_HOST" \
  --proxy-port "$PROXY_PORT" \
  --proxy-user "$PROXY_USER" \
  --proxy-pass "$PROXY_PASS"
```

### How It Works
- `routes.ts` switches routes dynamically between:
  - **Hyperbrowser (live)** → uses real URLs like `https://www.quora.com/topic/...`
  - **Local (offline)** → loads HTML from `src/sites/quora/fixtures/*.html`
- `core/loadTarget.ts` detects `kind: "html"` targets and calls `page.setContent()` instead of visiting a real URL.

### Example: Run Locally with Fixtures
```bash
npm run scraper -- \
  --driver local \
  --site quora \
  --topic "Growth Hacking" \
  --limit 10 \
```

This will:
1. Load **local fixture HTML** for login, search, and question pages.
2. Use the same adapter logic (selectors, parsing, expansion) as live mode.
3. Output JSON/CSV under `output/` — **no live Quora requests**.

### Example Routes
```ts
// src/sites/quora/routes.ts
const ROUTES = {
  hyper: {
    LOGIN: () => ({ kind: "url", url: "https://www.quora.com/login" }),
  },
  local: {
    LOGIN: () => ({ kind: "html", path: "src/sites/quora/fixtures/login_form_enabled.html" }),
  },
};
```

### When to Switch to Hyperbrowser
Switch to live mode once:
- ✅ Local runs produce expected outputs.
- ✅ Unit tests pass (`npm test`).
- ✅ You’re ready to verify live behavior or real-world DOM changes.

**Run live (headed, proxy, stealth):**
```bash
npm run scraper -- \
  --driver hyper \
  --site quora \
  --topic "Growth Hacking" \
  --limit 10 \
  --outdir output \
  --proxy-host "$PROXY_HOST" \
  --proxy-port "$PROXY_PORT" \
  --proxy-user "$PROXY_USER" \
  --proxy-pass "$PROXY_PASS"
```

> ⚠️ Hyperbrowser is ideal for end-to-end verification and production-grade runs, but **local fixtures** are best for day-to-day development.

## 🗂 Project Structure

```
.
├── src
│   ├── core
│   │   ├── browser.ts     # Hyperbrowser/local start-stop logic
│   │   ├── runner.ts      # login → search → collect orchestrator
│   │   ├── drafter.ts     # local draft answer generator
│   │   ├── storage.ts     # JSON & CSV writers
│   │   ├── waits.ts       # redirect & readiness helpers
│   │   ├── logger.ts      # Winston setup with daily rotation
│   │   └── loadTarget.ts  # Fixture or live URL loader
│   ├── sites
│   │   ├── registry.ts    # Adapter selector (Quora)
│   │   ├── types.ts       # Capability model
│   │   └── quora
│   │       ├── adapter.ts # Quora login/search/scraping logic
│   │       ├── dom.ts     # Selectors and DOM predicates
│   │       ├── routes.ts  # URL & fixture mapping
│   │       ├── dom.test.ts
│   │       └── fixtures/*.html
│   └── index.ts           # CLI entry point
├── output/                # generated JSON/CSV
├── logs/                  # daily-rotated logs
└── config files           # .env.example, eslint, jest, tsconfig, package.json
```

## 🚀 What It Does

- **Login** to Quora using credentials from `.env`
- **Navigate** to a topic (e.g., “Growth Hacking”)
- **Collect** the first *N* questions (title + URL)
- **Filter** and tag each question via `matched_keywords`
- **Draft** a short, **local-only** answer for each (not posted)
- **Export** structured results to:
  - `output/<site>_<topic>.json`
  - `output/<site>_<topic>.csv`
- **Log** execution in `logs/YYYY-MM-DD-*.log` (scoped & rotated)

> 🧩 Supports both **Hyperbrowser** (headed stealth mode with proxy) and **local Puppeteer** (fixture-based development).

---

## Quick Start

### Requirements
- Node.js **v18+**
- A manually created **Quora account**
- **Hyperbrowser API key**
- *(Optional)* Residential proxy for improved reliability

### Install
```bash
npm i
cp .env.example .env
# Fill in HYPERBROWSER_API_KEY, PROXY_*, QUORA_EMAIL, QUORA_PASS
```

### Run (interactive CLI)
```bash
npm run scraper # prompts: driver (local|hyper), site (quora), topic, limit
```

### Run (non-interactive)
```bash
npm run scraper -- \
  --driver hyper \
  --site quora \
  --topic "Growth Hacking" \
  --limit 10 \
  --outdir output \
  --proxy-host "$PROXY_HOST" \
  --proxy-port "$PROXY_PORT" \
  --proxy-user "$PROXY_USER" \
  --proxy-pass "$PROXY_PASS"
```

---

## Configuration

Set via `.env` or CLI flags:

```env
NODE_ENV=development

HYPERBROWSER_API_KEY=hb_xxx

# Optional but recommended:
PROXY_HOST=1.2.3.4
PROXY_PORT=12345
PROXY_USER=user
PROXY_PASS=pass

QUORA_EMAIL=example@domain.com
QUORA_PASS=strong-password
```

---

## How It Works (Architecture)

### Adapter Pattern
Each platform implements a `SiteAdapter` defining its capabilities:

- `ensureLoggedIn(page)` — logs into Quora safely with typed delays and submit checks
- `search(page, topic)` — performs topic search & redirects
- `collectQuestions(page, topic, limit)` — scrapes first *N* questions, expands “(more)”, and deduplicates results

```ts
// core/runner.ts
if (hasCapability(adapter, "login")) await adapter.ensureLoggedIn(page);
if (hasCapability(adapter, "search")) await adapter.search(page, topic);
if (hasCapability(adapter, "collectQuestions")) return adapter.collectQuestions(page, topic, limit);
```

### Hyperbrowser Lifecycle
`core/browser.ts` creates a **headed** stealth browser session, optionally using a proxy.
It connects via `wsEndpoint`, logs the live view URL, and gracefully stops the session on exit.

### Drafting & Storage
- `core/drafter.ts` generates short, clearly labeled **do-not-post** draft answers.
- `core/storage.ts` safely writes both **JSON** and **CSV** outputs with proper serialization.

### Logging
Structured via **Winston** with daily rotation.
Scopes include: `core:browser`, `adapter:quora`, `runner`, `storage`, and `cli`.

---

## Anti-Bot & Reliability

- ✅ **Headed mode** + Hyperbrowser **stealth**
- ✏️ Human-like typing delays (~40ms)
- 🔒 Guarded submit enablement (`aria-disabled`, `disabled`)
- 🕒 Safe navigation waits (`domcontentloaded`, `networkidle2`)
- 🔁 Incremental scroll + “(more)” expansion
- 🌍 **Proxy support** with authentication
- 🚫 **No posting** — drafts stored locally only

---

## Output Schema

```ts
type QAItem = {
  question: string;
  url: string;
  matched_keywords: string[]; // tags with selected topic
  drafted_answer: string;      // local-only short draft
  timestamp: string;           // ISO-8601 timestamp
};
```

- **JSON:** pretty-printed
- **CSV:** joins `matched_keywords` with `"|"`

---

## Testing

Unit tests use **JSDOM** to validate Quora’s DOM selectors.

```bash
npm test
# or test specific file
npm test --file src/sites/quora/dom.test.ts
```

---

## Samples and Logs

- **Sample outputs:** `output/quora_growth_hacking.json` and `.csv`
- **Logs:** `logs/2025-10-03-*.log` (scoped by module)

---

## Commands

```bash
# Install dependencies
npm i

# Lint / auto-fix
npm run lint
npm run lint:fix

# Run tests
npm test

# Run interactively
npm run scraper

# Run non-interactively (Hyperbrowser)
npm run scraper -- --driver hyper --site quora --topic "Funding" --limit 10
```
