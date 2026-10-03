import { ConsoleLogger, LogLevel } from "@slack/logger";

// Shared logger for code outside Bolt handlers, so DEBUG filters it the same
// way as Bolt's own logger (see init/index.ts).
export const logLevel = process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO;

const logger = new ConsoleLogger();
logger.setLevel(logLevel);
logger.setName("mermaid-preview");

export default logger;
