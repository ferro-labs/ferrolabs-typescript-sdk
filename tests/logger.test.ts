import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, resolveLogLevel } from "../src/_internal/logger.js";

describe("Logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("log levels", () => {
    it("outputs nothing when level is none", () => {
      const logger = new Logger("none");
      logger.debug("test");
      logger.info("test");
      logger.warn("test");
      logger.error("test");
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("debug level outputs all levels", () => {
      const logger = new Logger("debug");
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("info level skips debug", () => {
      const logger = new Logger("info");
      logger.debug("should not appear");
      logger.info("should appear");
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("warn level skips debug and info", () => {
      const logger = new Logger("warn");
      logger.debug("no");
      logger.info("no");
      logger.warn("yes");
      logger.error("yes");
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("error level only outputs errors", () => {
      const logger = new Logger("error");
      logger.debug("no");
      logger.info("no");
      logger.warn("no");
      logger.error("yes");
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("output format", () => {
    it("outputs structured JSON with timestamp, level, and message", () => {
      const logger = new Logger("debug");
      logger.info("hello");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<
        string,
        unknown
      >;
      expect(output["level"]).toBe("INFO");
      expect(output["msg"]).toBe("[ferro] hello");
      expect(output["ts"]).toBeDefined();
    });

    it("includes additional data fields", () => {
      const logger = new Logger("debug");
      logger.info("req", { method: "POST", url: "/v1/chat/completions" });

      const output = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<
        string,
        unknown
      >;
      expect(output["method"]).toBe("POST");
      expect(output["url"]).toBe("/v1/chat/completions");
    });

    it("uses custom prefix", () => {
      const logger = new Logger("debug", "my-app");
      logger.info("test");

      const output = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<
        string,
        unknown
      >;
      expect(output["msg"]).toBe("[my-app] test");
    });
  });

  describe("enabled property", () => {
    it("returns false for none", () => {
      expect(new Logger("none").enabled).toBe(false);
    });

    it("returns true for debug", () => {
      expect(new Logger("debug").enabled).toBe(true);
    });

    it("returns true for error", () => {
      expect(new Logger("error").enabled).toBe(true);
    });
  });
});

describe("resolveLogLevel", () => {
  const originalEnv = process.env["FERRO_LOG_LEVEL"];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["FERRO_LOG_LEVEL"] = originalEnv;
    } else {
      delete process.env["FERRO_LOG_LEVEL"];
    }
  });

  it("returns explicit value when provided", () => {
    expect(resolveLogLevel("debug")).toBe("debug");
  });

  it("reads FERRO_LOG_LEVEL env var", () => {
    process.env["FERRO_LOG_LEVEL"] = "warn";
    expect(resolveLogLevel()).toBe("warn");
  });

  it("is case-insensitive for env var", () => {
    process.env["FERRO_LOG_LEVEL"] = "DEBUG";
    expect(resolveLogLevel()).toBe("debug");
  });

  it("ignores invalid env var values", () => {
    process.env["FERRO_LOG_LEVEL"] = "verbose";
    expect(resolveLogLevel()).toBe("none");
  });

  it("defaults to none", () => {
    delete process.env["FERRO_LOG_LEVEL"];
    expect(resolveLogLevel()).toBe("none");
  });
});
