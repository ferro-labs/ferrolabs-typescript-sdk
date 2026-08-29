import { describe, it, expect } from "vitest";
import {
  FerroError,
  FerroAPIError,
  FerroAuthError,
  FerroBudgetExceededError,
  FerroPermissionError,
  FerroRateLimitError,
  FerroNotFoundError,
  FerroServerError,
  FerroConnectionError,
  FerroStreamError,
} from "../src/errors.js";

describe("FerroError", () => {
  it("has correct name property", () => {
    const err = new FerroError("test");
    expect(err.name).toBe("FerroError");
  });

  it("is an instance of Error", () => {
    const err = new FerroError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("stores the message", () => {
    const err = new FerroError("something went wrong");
    expect(err.message).toBe("something went wrong");
  });
});

describe("FerroAPIError", () => {
  it("has correct name property", () => {
    const err = new FerroAPIError("bad request");
    expect(err.name).toBe("FerroAPIError");
  });

  it("stores status, code, and requestId", () => {
    const err = new FerroAPIError("bad request", {
      status: 400,
      code: "invalid_param",
      requestId: "req-123",
    });
    expect(err.status).toBe(400);
    expect(err.code).toBe("invalid_param");
    expect(err.requestId).toBe("req-123");
  });

  it("allows undefined options", () => {
    const err = new FerroAPIError("fail");
    expect(err.status).toBeUndefined();
    expect(err.code).toBeUndefined();
    expect(err.requestId).toBeUndefined();
  });

  it("is an instance of FerroError", () => {
    const err = new FerroAPIError("test");
    expect(err).toBeInstanceOf(FerroError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("FerroAuthError", () => {
  it("has correct name property", () => {
    const err = new FerroAuthError("unauthorized");
    expect(err.name).toBe("FerroAuthError");
  });

  it("defaults to status 401", () => {
    const err = new FerroAuthError("unauthorized");
    expect(err.status).toBe(401);
  });

  it("defaults to code authentication_error", () => {
    const err = new FerroAuthError("unauthorized");
    expect(err.code).toBe("authentication_error");
  });

  it("stores requestId", () => {
    const err = new FerroAuthError("unauthorized", { requestId: "req-abc" });
    expect(err.requestId).toBe("req-abc");
  });

  it("is an instance of FerroAPIError and FerroError", () => {
    const err = new FerroAuthError("unauthorized");
    expect(err).toBeInstanceOf(FerroAPIError);
    expect(err).toBeInstanceOf(FerroError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("FerroRateLimitError", () => {
  it("has correct name property", () => {
    const err = new FerroRateLimitError("rate limited");
    expect(err.name).toBe("FerroRateLimitError");
  });

  it("defaults to status 429", () => {
    const err = new FerroRateLimitError("rate limited");
    expect(err.status).toBe(429);
  });

  it("defaults to code rate_limit_error", () => {
    const err = new FerroRateLimitError("rate limited");
    expect(err.code).toBe("rate_limit_error");
  });

  it("is an instance of FerroAPIError", () => {
    const err = new FerroRateLimitError("rate limited");
    expect(err).toBeInstanceOf(FerroAPIError);
    expect(err).toBeInstanceOf(FerroError);
  });

  it("stores retryAfter", () => {
    const err = new FerroRateLimitError("rate limited", { retryAfter: 3 });
    expect(err.retryAfter).toBe(3);
  });
});

describe("FerroBudgetExceededError", () => {
  it("defaults to 402 insufficient_quota", () => {
    const err = new FerroBudgetExceededError("budget");
    expect(err.name).toBe("FerroBudgetExceededError");
    expect(err.status).toBe(402);
    expect(err.code).toBe("insufficient_quota");
    expect(err).toBeInstanceOf(FerroAPIError);
  });
});

describe("FerroPermissionError", () => {
  it("defaults to 403 permission_error and keeps a gateway code", () => {
    const err = new FerroPermissionError("nope", {
      code: "insufficient_scope",
    });
    expect(err.name).toBe("FerroPermissionError");
    expect(err.status).toBe(403);
    expect(err.code).toBe("insufficient_scope");
    expect(err).toBeInstanceOf(FerroAPIError);
  });
});

describe("FerroNotFoundError", () => {
  it("has correct name property", () => {
    const err = new FerroNotFoundError("not found");
    expect(err.name).toBe("FerroNotFoundError");
  });

  it("defaults to status 404", () => {
    const err = new FerroNotFoundError("not found");
    expect(err.status).toBe(404);
  });

  it("defaults to code not_found_error", () => {
    const err = new FerroNotFoundError("not found");
    expect(err.code).toBe("not_found_error");
  });

  it("is an instance of FerroAPIError", () => {
    const err = new FerroNotFoundError("not found");
    expect(err).toBeInstanceOf(FerroAPIError);
    expect(err).toBeInstanceOf(FerroError);
  });
});

describe("FerroServerError", () => {
  it("has correct name property", () => {
    const err = new FerroServerError("internal error");
    expect(err.name).toBe("FerroServerError");
  });

  it("defaults to status 500", () => {
    const err = new FerroServerError("internal error");
    expect(err.status).toBe(500);
  });

  it("accepts a custom status", () => {
    const err = new FerroServerError("bad gateway", { status: 502 });
    expect(err.status).toBe(502);
  });

  it("defaults to code server_error", () => {
    const err = new FerroServerError("internal error");
    expect(err.code).toBe("server_error");
  });

  it("is an instance of FerroAPIError", () => {
    const err = new FerroServerError("internal error");
    expect(err).toBeInstanceOf(FerroAPIError);
    expect(err).toBeInstanceOf(FerroError);
  });
});

describe("FerroConnectionError", () => {
  it("has correct name property", () => {
    const err = new FerroConnectionError("connection failed");
    expect(err.name).toBe("FerroConnectionError");
  });

  it("is an instance of FerroError but not FerroAPIError", () => {
    const err = new FerroConnectionError("connection failed");
    expect(err).toBeInstanceOf(FerroError);
    expect(err).not.toBeInstanceOf(FerroAPIError);
  });
});

describe("FerroStreamError", () => {
  it("has correct name property", () => {
    const err = new FerroStreamError("stream parse failed");
    expect(err.name).toBe("FerroStreamError");
  });

  it("is an instance of FerroError but not FerroAPIError", () => {
    const err = new FerroStreamError("stream parse failed");
    expect(err).toBeInstanceOf(FerroError);
    expect(err).not.toBeInstanceOf(FerroAPIError);
  });

  it("carries the gateway stream error code", () => {
    const err = new FerroStreamError("boom", { code: "stream_timeout" });
    expect(err.code).toBe("stream_timeout");
  });
});
