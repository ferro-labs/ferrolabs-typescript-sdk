export class FerroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FerroError";
  }
}

export class FerroAPIError extends FerroError {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      requestId?: string;
    },
  ) {
    super(message);
    this.name = "FerroAPIError";
    this.status = options?.status;
    this.code = options?.code;
    this.requestId = options?.requestId;
  }
}

export class FerroAuthError extends FerroAPIError {
  constructor(message: string, options?: { requestId?: string }) {
    super(message, { status: 401, code: "authentication_error", ...options });
    this.name = "FerroAuthError";
  }
}

export class FerroRateLimitError extends FerroAPIError {
  constructor(message: string, options?: { requestId?: string }) {
    super(message, { status: 429, code: "rate_limit_error", ...options });
    this.name = "FerroRateLimitError";
  }
}

export class FerroNotFoundError extends FerroAPIError {
  constructor(message: string, options?: { requestId?: string }) {
    super(message, { status: 404, code: "not_found_error", ...options });
    this.name = "FerroNotFoundError";
  }
}

export class FerroServerError extends FerroAPIError {
  constructor(
    message: string,
    options?: { status?: number; requestId?: string },
  ) {
    super(message, {
      status: options?.status ?? 500,
      code: "server_error",
      requestId: options?.requestId,
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

export class FerroStreamError extends FerroError {
  constructor(message: string) {
    super(message);
    this.name = "FerroStreamError";
  }
}
