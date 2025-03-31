import { config } from "../config.ts";
import { ErrorSeverity } from "../types/error.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = config.logging.level as LogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: config.env === "development" ? error.stack : undefined
    } : undefined;

    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
      ...(errorInfo && { error: errorInfo })
    };

    return JSON.stringify(logData);
  }

  private logToFile(formattedMessage: string) {
    // ファイルへのログ出力は将来の拡張のために予約
    // 現在は標準出力のみを使用
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      const formatted = this.formatMessage("debug", message, undefined, context);
      console.debug(formatted);
      this.logToFile(formatted);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      const formatted = this.formatMessage("info", message, undefined, context);
      console.info(formatted);
      this.logToFile(formatted);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      const formatted = this.formatMessage("warn", message, undefined, context);
      console.warn(formatted);
      this.logToFile(formatted);
    }
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    if (this.shouldLog("error")) {
      const formatted = this.formatMessage("error", message, error, context);
      console.error(formatted);
      this.logToFile(formatted);
    }
  }

  // エラーの重要度に基づいてログレベルを決定
  logWithSeverity(
    message: string,
    severity: ErrorSeverity,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    switch (severity) {
      case "FATAL":
      case "ERROR":
        this.error(message, error, context);
        break;
      case "WARN":
        this.warn(message, context);
        break;
      case "INFO":
        this.info(message, context);
        break;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();
