export class FerroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FerroError";
  }
}

export interface APIErrorOptions {
  status?: number;
  /** The gateway's `error.code` (e.g. `invalid_api_key`, `model_not_found`). */
  code?: string;
  requestId?: string;
}

export class FerroAPIError extends FerroError {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(message: string, options?: APIErrorOptions) {
    super(message);
    this.name = "FerroAPIError";
    this.status = options?.status;
    this.code = options?.code;
    this.requestId = options?.requestId;
  }
}

type SubclassOptions = Omit<APIErrorOptions, "status">;

/** 401 — missing or invalid credential. */
export class FerroAuthError extends FerroAPIError {
  constructor(message: string, options?: SubclassOptions) {
    super(message, { code: "authentication_error", ...options, status: 401 });
    this.name = "FerroAuthError";
  }
}

/** 402 `insufficient_quota` — the key's budget is exhausted. */
export class FerroBudgetExceededError extends FerroAPIError {
  constructor(message: string, options?: SubclassOptions) {
    super(message, { code: "insufficient_quota", ...options, status: 402 });
    this.name = "FerroBudgetExceededError";
  }
}

/** 403 `insufficient_scope` — the key lacks the scope for this route. */
export class FerroPermissionError extends FerroAPIError {
  constructor(message: string, options?: SubclassOptions) {
    super(message, { code: "permission_error", ...options, status: 403 });
    this.name = "FerroPermissionError";
  }
}

/** 429 — the gateway always sets `Retry-After` on its own rate limits. */
export class FerroRateLimitError extends FerroAPIError {
  /** Seconds from the `Retry-After` header, when present. */
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    options?: SubclassOptions & { retryAfter?: number },
  ) {
    super(message, { code: "rate_limit_error", ...options, status: 429 });
    this.name = "FerroRateLimitError";
    this.retryAfter = options?.retryAfter;
  }
}

export class FerroNotFoundError extends FerroAPIError {
  constructor(message: string, options?: SubclassOptions) {
    super(message, { code: "not_found_error", ...options, status: 404 });
    this.name = "FerroNotFoundError";
  }
}

export class FerroServerError extends FerroAPIError {
  constructor(message: string, options?: APIErrorOptions) {
    super(message, {
      code: "server_error",
      ...options,
      status: options?.status ?? 500,
    });
    this.name = "FerroServerError";
  }
}

export class FerroConnectionError extends FerroError {
  constructor(message: string) {
    super(message);
    this.name = "FerroConnectionError";
  }
}

/** SSE parse failure or a mid-stream `{"error": ...}` frame. */
export class FerroStreamError extends FerroError {
  /** The gateway's error code (`stream_error`, `stream_timeout`), if any. */
  readonly code: string | undefined;

  constructor(message: string, options?: { code?: string }) {
    super(message);
    this.name = "FerroStreamError";
    this.code = options?.code;
  }
}
