import { HttpClient } from "./_internal/http.js";
import { FerroAuthError } from "./errors.js";
import { Admin } from "./resources/admin/index.js";
import { Completions } from "./resources/completions.js";
import { Embeddings } from "./resources/embeddings.js";
import { Images } from "./resources/images.js";
import { Models } from "./resources/models.js";
import type { FerroClientOptions } from "./types.js";
import { VERSION } from "./version.js";

const DEFAULT_BASE_URL = "http://localhost:8080";
const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_MAX_RETRIES = 2;

export class FerroClient {
  readonly chat: { completions: Completions };
  readonly embeddings: Embeddings;
  readonly images: Images;
  readonly models: Models;
  readonly admin: Admin;

  private readonly http: HttpClient;

  constructor(options?: FerroClientOptions) {
    const apiKey = resolveApiKey(options?.apiKey);
    const baseUrl = resolveBaseUrl(options?.baseUrl);
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (maxRetries < 0 || !Number.isInteger(maxRetries)) {
      throw new Error("maxRetries must be a non-negative integer");
    }

    this.http = new HttpClient({
      baseUrl,
      apiKey,
      timeout,
      maxRetries,
      defaultHeaders: {
        ...options?.defaultHeaders,
      },
      fetchFn: options?.fetch ?? globalThis.fetch,
    });

    const completions = new Completions(this.http);
    this.chat = { completions };
    this.embeddings = new Embeddings(this.http);
    this.images = new Images(this.http);
    this.models = new Models(this.http);
    this.admin = new Admin(this.http);
  }

  get version(): string {
    return VERSION;
  }
}

function resolveApiKey(explicit?: string): string {
  if (explicit) return explicit;

  const env =
    typeof process !== "undefined"
      ? process.env
      : ({} as Record<string, string | undefined>);

  const ferroKey = env["FERRO_API_KEY"];
  if (ferroKey) return ferroKey;

  const openaiKey = env["OPENAI_API_KEY"];
  if (openaiKey) return openaiKey;

  throw new FerroAuthError(
    "API key is required. Pass apiKey to the constructor, or set FERRO_API_KEY or OPENAI_API_KEY environment variable.",
  );
}

function resolveBaseUrl(explicit?: string): string {
  if (explicit) return explicit.replace(/\/+$/, "");

  const env =
    typeof process !== "undefined"
      ? process.env
      : ({} as Record<string, string | undefined>);

  const ferroUrl = env["FERRO_BASE_URL"];
  if (ferroUrl) return ferroUrl.replace(/\/+$/, "");

  return DEFAULT_BASE_URL;
}
