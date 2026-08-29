import type { HttpClient } from "../_internal/http.js";
import type { ImageGenerateParams, ImageResponse } from "../types.js";

export class Images {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async generate(params: ImageGenerateParams): Promise<ImageResponse> {
    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
    };

    if (params.n !== undefined) body["n"] = params.n;
    if (params.size !== undefined) body["size"] = params.size;
    if (params.quality !== undefined) body["quality"] = params.quality;
    if (params.response_format !== undefined)
      body["response_format"] = params.response_format;
    if (params.style !== undefined) body["style"] = params.style;
    if (params.user !== undefined) body["user"] = params.user;

    return this.http.request<ImageResponse>("POST", "/v1/images/generations", {
      json: body,
      meta: true,
    });
  }
}
