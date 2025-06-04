import * as Sentry from "@sentry/node";

type LogLevel = "debug" | "info" | "warn" | "error";
type SentrySeverity = "debug" | "info" | "warning" | "error" | "fatal";

interface LoggerOptions {
  level?: LogLevel;
  message?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || "info";
  }

  // Add reset method for testing
  reset() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private getSentrySeverity(level: LogLevel): SentrySeverity {
    const severityMap: Record<LogLevel, SentrySeverity> = {
      debug: "debug",
      info: "info",
      warn: "warning",
      error: "error",
    };
    return severityMap[level];
  }

  private log(level: LogLevel, options: LoggerOptions) {
    if (!this.shouldLog(level)) return;

    const { message, msg, ...context } = options;
    const severity = this.getSentrySeverity(level);
    const logMessage = message || msg || "No message provided";

    // Send to Sentry only in production and only for error level
    if (process.env.NODE_ENV === "production" && level === "error") {
      Sentry.captureException(new Error(logMessage as string), {
        level: severity,
        extra: context,
      });
    }

    // Console output only in non-production environments
    if (process.env.NODE_ENV !== "production") {
      const timestamp = new Date().toISOString();
      console[level](
        `[${timestamp}] ${level.toUpperCase()}: ${logMessage}`,
        context
      );
    }
  }

  debug(options: LoggerOptions) {
    this.log("debug", options);
  }

  info(options: LoggerOptions) {
    this.log("info", options);
  }

  warn(options: LoggerOptions) {
    this.log("warn", options);
  }

  error(options: LoggerOptions) {
    this.log("error", options);
  }
}

const logger = new Logger();
export default logger;
