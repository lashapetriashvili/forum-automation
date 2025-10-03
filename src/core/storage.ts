import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";
import { getLogger } from "./logger";
import type { QAItem } from "./types";

const logger = getLogger("storage");

export async function saveJSON<T>(outDir: string, name: string, data: T): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, `${name}.json`);

  let json: string;
  try {
    json = JSON.stringify(data, null, 2);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`saveJSON: value is not JSON-serializable: ${msg}`);
    throw new Error(`saveJSON: value is not JSON-serializable: ${msg}`);
  }

  fs.writeFileSync(p, json, "utf8");
  return p;
}

export async function saveCSV(outDir: string, name: string, rows: QAItem[]): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, `${name}.csv`);
  const writer = createObjectCsvWriter({
    path: p,
    header: [
      { id: "question", title: "question" },
      { id: "url", title: "url" },
      { id: "matched_keywords", title: "matched_keywords" },
      { id: "drafted_answer", title: "drafted_answer" },
      { id: "timestamp", title: "timestamp" },
    ],
  });

  await writer.writeRecords(
    rows.map((r) => ({
      ...r,
      matched_keywords: Array.isArray(r.matched_keywords)
        ? r.matched_keywords.join("|")
        : (r.matched_keywords ?? ""),
    }))
  );

  return p;
}
