export type LogLevel = "debug" | "info" | "warn" | "error" | "none";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

export class Logger {
  private readonly level: number;
  private readonly prefix: string;

  constructor(level: LogLevel = "none", prefix = "ferro") {
    this.level = LEVEL_ORDER[level];
    this.prefix = prefix;
  }

  get enabled(): boolean {
    return this.level < LEVEL_ORDER.none;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LEVEL_ORDER.debug, "DEBUG", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LEVEL_ORDER.info, "INFO", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LEVEL_ORDER.warn, "WARN", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LEVEL_ORDER.error, "ERROR", message, data);
  }

  private log(
    level: number,
    tag: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (level < this.level) return;

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level: tag,
      msg: `[${this.prefix}] ${message}`,
    };

    if (data) {
      Object.assign(entry, data);
    }

    const line = JSON.stringify(entry);

    if (level >= LEVEL_ORDER.error) {
      console.error(line);
    } else if (level >= LEVEL_ORDER.warn) {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export function resolveLogLevel(explicit?: LogLevel): LogLevel {
  if (explicit) return explicit;

  const env =
    typeof process !== "undefined"
      ? process.env
      : ({} as Record<string, string | undefined>);

  const envLevel = env["FERRO_LOG_LEVEL"]?.toLowerCase();
  if (envLevel && envLevel in LEVEL_ORDER) {
    return envLevel as LogLevel;
  }

  return "none";
}
