import type { HttpClient } from "../_internal/http.js";
import type { ModerationCreateParams, ModerationResponse } from "../types.js";

export class Moderations {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(params: ModerationCreateParams): Promise<ModerationResponse> {
    return this.http.request<ModerationResponse>("POST", "/v1/moderations", {
      json: params,
      meta: true,
    });
  }
}
