import { config } from "../config.ts";
import { ErrorSeverity } from "../types/error.ts";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: -1, // より詳細なトレースレベルを追加
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// メトリクス記録のための型定義
interface MetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

// ビジネスイベント用の型定義
interface BusinessEvent {
  type: string;
  userId?: string;
  gameId?: string;
  details: Record<string, unknown>;
}

class Logger {
  private level: LogLevel;
  private startTime: Record<string, number> = {}; // パフォーマンス計測用

  constructor() {
    this.level = (config.logging.level as LogLevel) || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString();
    const errorInfo = error
      ? {
        name: error.name,
        message: error.message,
        stack: config.env === "development" || config.env === "test" ? error.stack : undefined,
      }
      : undefined;

    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
      ...(errorInfo && { error: errorInfo }),
    };

    return JSON.stringify(logData);
  }

  // 追加: ファイルへのログ出力機能（将来拡張用）
  private logToFile(_formattedMessage: string) {
    // 現在は標準出力のみ使用
    // 将来的にファイルログを実装する場合はここに記述
  }

  /**
   * トレースレベルのログを出力する（最も詳細なデバッグ情報）
   * 開発・テスト環境のみで使用することを推奨
   */
  trace(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("trace")) {
      const formatted = this.formatMessage("trace", message, undefined, context);
      console.debug(`[TRACE] ${formatted}`);
      this.logToFile(formatted);
    }
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
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    if (this.shouldLog("error")) {
      let actualError: Error | undefined;
      let actualContext: Record<string, unknown> | undefined;

      // errorOrContextパラメータの型に基づいて処理を分岐
      if (errorOrContext instanceof Error) {
        actualError = errorOrContext;
        actualContext = context;
      } else {
        actualError = undefined;
        actualContext = errorOrContext;
      }

      const formatted = this.formatMessage("error", message, actualError, actualContext);
      console.error(formatted);
      this.logToFile(formatted);
    }
  }

  // エラーの重要度に基づいてログレベルを決定
  logWithSeverity(
    message: string,
    severity: ErrorSeverity,
    error?: Error,
    context?: Record<string, unknown>,
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

  /**
   * パフォーマンス計測の開始
   * @param label 計測の識別子
   */
  startTimer(label: string): void {
    this.startTime[label] = performance.now();
    this.debug(`パフォーマンス計測開始: ${label}`);
  }

  /**
   * パフォーマンス計測の終了とログ出力
   * @param label 計測の識別子
   * @param context 追加コンテキスト情報
   */
  endTimer(label: string, context?: Record<string, unknown>): number {
    if (!this.startTime[label]) {
      this.warn(`計測開始されていないラベルの計測終了が呼ばれました: ${label}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - this.startTime[label];
    const durationMs = Math.round(duration * 100) / 100; // 小数点2桁まで

    this.info(`パフォーマンス計測結果: ${label} - ${durationMs}ms`, {
      metric: {
        name: label,
        value: durationMs,
        unit: "ms",
      },
      ...context,
    });

    delete this.startTime[label];
    return durationMs;
  }

  /**
   * メトリクスの記録
   * @param metric メトリクスデータ
   * @param context 追加コンテキスト情報
   */
  metric(metric: MetricData, context?: Record<string, unknown>): void {
    this.info(`メトリクス: ${metric.name} = ${metric.value}${metric.unit || ""}`, {
      metric,
      ...context,
    });
  }

  /**
   * ビジネスイベントのログ記録
   * @param event ビジネスイベント情報
   * @param context 追加コンテキスト情報
   */
  businessEvent(event: BusinessEvent, context?: Record<string, unknown>): void {
    this.info(`ビジネスイベント: ${event.type}`, {
      event,
      ...context,
    });
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();
