import type { HttpClient } from "../_internal/http.js";
import { FerroNotFoundError } from "../errors.js";
import type { ModelInfo, ModelListParams } from "../types.js";

/**
 * The gateway serves only `GET /v1/models` and ignores query parameters, and
 * `GET /v1/models/{id}` would be forwarded upstream with the operator's
 * credential. Every lookup here fetches the catalog once and filters locally.
 */
export class Models {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(params?: ModelListParams): Promise<ModelInfo[]> {
    const data = await this.http.request<{ data: ModelInfo[] } | ModelInfo[]>(
      "GET",
      "/v1/models",
    );
    const models = Array.isArray(data) ? data : data.data;

    return models.filter(
      (m) =>
        (!params?.provider || m.owned_by === params.provider) &&
        (!params?.capability ||
          (m.capabilities?.includes(params.capability) ?? false)),
    );
  }

  async retrieve(modelId: string): Promise<ModelInfo> {
    const model = (await this.list()).find((m) => m.id === modelId);
    if (!model) {
      throw new FerroNotFoundError(
        `Model "${modelId}" is not in the gateway catalog`,
        { code: "model_not_found" },
      );
    }
    return model;
  }

  async search(query: string): Promise<ModelInfo[]> {
    const needle = query.toLowerCase();
    return (await this.list()).filter((m) =>
      m.id.toLowerCase().includes(needle),
    );
  }
}
