import "dotenv/config";
import { Command } from "commander";
import inquirer from "inquirer";
import { startBrowser, stopBrowser } from "./core/browser";
import { getAdapter } from "./sites/registry";
import { runWorkflow } from "./core/runner";
import { getLogger } from "./core/logger";
import { addDraftAnswer } from "./core/drafter";
import { saveJSON, saveCSV } from "./core/storage";

const program = new Command();

program
  .name("scraper")
  .description("CLI to scrape websites")
  .option("-d, --driver <driver>", "driver: local|hyper")
  .option("-s, --site <name>", "site adapter")
  .option("-t, --topic <seed>", "topic seed", process.env.DEFAULT_TOPIC)
  .option("-l, --limit <n>", "number of questions", (v) => parseInt(v, 10))
  .option("-o, --outdir <dir>", "output directory", "output")
  .option("--proxy-host <host>", "proxy host", process.env.PROXY_HOST)
  .option("--proxy-port <port>", "proxy port", process.env.PROXY_PORT)
  .option("--proxy-user <user>", "proxy username", process.env.PROXY_USER)
  .option("--proxy-pass <pass>", "proxy password", process.env.PROXY_PASS)
  .parse(process.argv);

const {
  site: siteOpt,
  topic: topicOpt,
  limit: limitOpt,
  driver: driverOpt,
  outdir,
  proxyHost,
  proxyPort,
  proxyUser,
  proxyPass,
} = program.opts();

let site = siteOpt;
let topic = topicOpt;
let limit = limitOpt;
let driver = driverOpt;

(async () => {
  if (!driver) {
    const ans = await inquirer.prompt([
      {
        type: "list",
        name: "driver",
        message: "Driver:",
        choices: ["local", "hyper"],
        default: "local",
      },
    ]);
    driver = ans.driver;
  }

  if (!site) {
    const ans = await inquirer.prompt([
      {
        type: "list",
        name: "site",
        message: "Choose site:",
        choices: ["quora"],
      },
    ]);
    site = ans.site;
  }
  if (!topic) {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "topic",
        message: "Topic seed (e.g., Growth Hacking):",
        default: "Growth Hacking",
      },
    ]);
    topic = ans.topic;
  }
  if (!limit || Number.isNaN(limit)) {
    const ans = await inquirer.prompt([
      {
        type: "number",
        name: "limit",
        message: "How many questions?",
        default: 10,
      },
    ]);
    limit = ans.limit;
  }

  const log = getLogger("cli");

  const adapter = getAdapter(site, driver);
  const ctx = await startBrowser(driver, {
    headless: false,
    proxy: {
      host: proxyHost,
      port: Number(proxyPort),
      username: proxyUser,
      password: proxyPass,
    },
  });

  try {
    const page = (await ctx.browser.pages())[0] || (await ctx.browser.newPage());
    const result = await runWorkflow(adapter, page, { topic: topic!, limit: limit! });
    const base = `${site}_${topic.replace(/\s+/g, "_").toLowerCase()}`;

    if (!result) {
      log.warn("⚠️  No result produced");
      return;
    } else {
      const jsonPath = await saveJSON(outdir, base, addDraftAnswer(result));
      const csvPath = await saveCSV(outdir, base, addDraftAnswer(result));

      log.info(`✅ Done, got ${result?.length ?? 0} JsonPath: ${jsonPath} CSVPath: ${csvPath}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(`❌ Error: ${msg}`);
  } finally {
    await stopBrowser(ctx);
  }
})();
