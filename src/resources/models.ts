import type { HttpClient } from "../_internal/http.js";
import type { ModelInfo, ModelListParams } from "../types.js";

export class Models {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(params?: ModelListParams): Promise<ModelInfo[]> {
    const queryParams: Record<string, string> = {};
    if (params?.provider) queryParams["provider"] = params.provider;
    if (params?.capability) queryParams["capability"] = params.capability;

    const data = await this.http.request<
      { data: ModelInfo[] } | ModelInfo[]
    >("GET", "/v1/models", { params: queryParams });

    return Array.isArray(data) ? data : data.data;
  }

  async retrieve(modelId: string): Promise<ModelInfo> {
    return this.http.request<ModelInfo>(
      "GET",
      `/v1/models/${encodeURIComponent(modelId)}`,
    );
  }

  async search(query: string): Promise<ModelInfo[]> {
    const data = await this.http.request<
      { data: ModelInfo[] } | ModelInfo[]
    >("GET", "/v1/models", { params: { search: query } });

    return Array.isArray(data) ? data : data.data;
  }
}
