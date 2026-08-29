import type { HttpClient } from "../_internal/http.js";
import { FerroError } from "../errors.js";
import type { Response, ResponseCreateParams } from "../types.js";

/**
 * OpenAI Responses API via the gateway (`/v1/responses`).
 *
 * `create()` is model-routed, governed and priced like chat. `retrieve()` and
 * `delete()` are id-routed and answer 501 (`responses_not_configured`) unless
 * the gateway config sets `responses_target`. Streaming is not supported by
 * this client in 0.3.x.
 */
export class Responses {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(params: ResponseCreateParams): Promise<Response> {
    // `stream` is typed `never`; guard the untyped/JS path before any request.
    if ((params as Record<string, unknown>)["stream"] === true) {
      throw new FerroError(
        "Responses streaming is not supported by this client; use chat.completions for streaming",
      );
    }
    return this.http.request<Response>("POST", "/v1/responses", {
      json: params,
      meta: true,
    });
  }

  async retrieve(id: string): Promise<Response> {
    return this.http.request<Response>(
      "GET",
      `/v1/responses/${encodeURIComponent(id)}`,
      { meta: true },
    );
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>(
      "DELETE",
      `/v1/responses/${encodeURIComponent(id)}`,
    );
  }
}
