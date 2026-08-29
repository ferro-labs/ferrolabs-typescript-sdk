import type { HttpClient } from "../_internal/http.js";
import type { EmbeddingCreateParams, EmbeddingResponse } from "../types.js";

export class Embeddings {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(params: EmbeddingCreateParams): Promise<EmbeddingResponse> {
    const body: Record<string, unknown> = {
      model: params.model,
      input: params.input,
    };

    if (params.encoding_format !== undefined)
      body["encoding_format"] = params.encoding_format;
    if (params.dimensions !== undefined) body["dimensions"] = params.dimensions;
    if (params.user !== undefined) body["user"] = params.user;

    return this.http.request<EmbeddingResponse>("POST", "/v1/embeddings", {
      json: body,
      meta: true,
    });
  }
}
