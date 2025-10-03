import { Hyperbrowser } from "@hyperbrowser/sdk";
import { connect, type Browser as CoreBrowser } from "puppeteer-core";
import puppeteer from "puppeteer";
import { getLogger } from "./logger";

export type Driver = "local" | "hyper";

export type HyperCtx = {
  mode: "hyper";
  hb: InstanceType<typeof Hyperbrowser>;
  session: { id: string; liveUrl?: string; wsEndpoint: string };
  browser: CoreBrowser;
};

export type LocalCtx = {
  mode: "local";
  browser: CoreBrowser;
};

export type BrowserCtx = HyperCtx | LocalCtx;

type StartOpts = {
  headless?: boolean;
  proxy?: { host: string; port: number; username?: string; password?: string } | null;
};

type SessionParams = {
  mode: "headed" | "headless";
  useStealth: boolean;
  enableWebRecording: boolean;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
};

const log = getLogger("core:browser");

export async function startBrowser(driver: Driver, opts: StartOpts = {}): Promise<BrowserCtx> {
  const headless = opts.headless ?? false;

  if (driver === "local") {
    const launchArgs: string[] = [];
    if (opts.proxy) {
      launchArgs.push(`--proxy-server=${opts.proxy.host}:${opts.proxy.port}`);
    }
    const local = await puppeteer.launch({
      headless,
      args: launchArgs,
      defaultViewport: null,
    });
    const browser = local as unknown as CoreBrowser;
    return { mode: "local", browser };
  }

  // hyper driver
  const apiKey = process.env.HYPERBROWSER_API_KEY;
  if (!apiKey) {
    log.error("HYPERBROWSER_API_KEY is not set");
    throw new Error("HYPERBROWSER_API_KEY is required for hyper driver");
  }

  const hb = new Hyperbrowser({ apiKey });
  const proxy =
    opts.proxy ??
    (process.env.PROXY_HOST && process.env.PROXY_PORT
      ? {
          host: process.env.PROXY_HOST,
          port: Number(process.env.PROXY_PORT),
          username: process.env.PROXY_USER,
          password: process.env.PROXY_PASS,
        }
      : null);

  const sessionParams: SessionParams = {
    mode: headless ? "headless" : "headed",
    useStealth: true,
    enableWebRecording: true,
    ...(proxy ? { proxy } : {}),
  };

  const session = await hb.sessions.create(sessionParams);

  if (session.liveUrl) log.info(`🌐 Hyperbrowser live view URL: ${session.liveUrl}`);

  const browser = await connect({ browserWSEndpoint: session.wsEndpoint, defaultViewport: null });

  return {
    mode: "hyper",
    hb,
    session: { id: session.id, liveUrl: session.liveUrl, wsEndpoint: session.wsEndpoint },
    browser,
  };
}

export async function applyProxyAuthIfNeeded(
  page: import("puppeteer-core").Page,
  proxy?: StartOpts["proxy"]
) {
  if (proxy?.username && proxy?.password) {
    try {
      await page.authenticate({ username: proxy.username, password: proxy.password });
    } catch (e) {
      log.warn("Proxy auth failed (local): " + (e instanceof Error ? e.message : String(e)));
    }
  }
}

export async function stopBrowser(ctx: BrowserCtx): Promise<void> {
  try {
    await ctx.browser.close();
  } catch (err) {
    log.warn("⚠️ Failed to close browser:", err instanceof Error ? err.message : String(err));
  }
  if (ctx.mode === "hyper") {
    try {
      await ctx.hb.sessions.stop(ctx.session.id);
    } catch (err) {
      log.warn("⚠️ Failed to stop HB session:", err instanceof Error ? err.message : String(err));
    }
  }
}
