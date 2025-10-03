/* eslint-disable no-useless-escape */
import fs from "fs";
import { createLogger, format, transports, type Logger } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type Transport from "winston-transport";
import type { TransformableInfo } from "logform";

const {
  LOG_LEVEL = "info",
  LOG_DIR = "logs",
  NODE_ENV = "development",
  LOG_MAX_FILES = "14d",
  LOG_MAX_SIZE = "20m",
} = process.env;

fs.mkdirSync(LOG_DIR, { recursive: true });

function sanitizeSegment(s: string): string {
  const cleaned = s.replace(/[\/\\?<>\:\*\|"'%]/g, "-").replace(/\s+/g, "-");
  return cleaned.replace(/^[\.-]+|[\.-]+$/g, "").slice(0, 80) || "log";
}

type LogInfo = TransformableInfo & { timestamp?: string; stack?: string };

const baseFormats = [
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  format.errors({ stack: true }),
  format.splat(),
  format.json(),
];

const consoleFormat = format.combine(
  ...baseFormats,
  format.colorize({ all: true }),
  format.printf((info: LogInfo) => {
    const { timestamp = "", level, message, stack, ...meta } = info;
    const ctx = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return stack
      ? `${timestamp} ${level} ${String(message)}\n${stack}${ctx}`
      : `${timestamp} ${level} ${String(message)}${ctx}`;
  })
);

const fileFormat = format.combine(...baseFormats);

function makeTransports(scope?: string): Transport[] {
  const ts: Transport[] = [];

  ts.push(
    new transports.Console({
      level: LOG_LEVEL,
      format: consoleFormat,
      handleExceptions: true,
    })
  );

  const safeScope = scope ? `-${sanitizeSegment(scope)}` : "";
  const filename = `%DATE%${safeScope}.log`;

  ts.push(
    new DailyRotateFile({
      level: LOG_LEVEL,
      dirname: LOG_DIR, // keep path concerns here
      filename, // keep ONLY the base name here
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      format: fileFormat,
    })
  );

  return ts;
}

export const logger: Logger = createLogger({
  level: LOG_LEVEL,
  defaultMeta: { env: NODE_ENV },
  transports: makeTransports(),
  exitOnError: false,
});

export function getLogger(scope: string): Logger {
  return createLogger({
    level: LOG_LEVEL,
    defaultMeta: { env: NODE_ENV, scope },
    transports: makeTransports(scope),
    exitOnError: false,
  });
}

export function hijackConsole(l: Logger = logger): void {
  const join = (a: unknown[]) => a.map(String).join(" ");
  console.log = (...a: unknown[]) => l.info(join(a));
  console.info = (...a: unknown[]) => l.info(join(a));
  console.warn = (...a: unknown[]) => l.warn(join(a));
  console.error = (...a: unknown[]) => l.error(join(a));
  console.debug = (...a: unknown[]) => l.debug(join(a));
}
