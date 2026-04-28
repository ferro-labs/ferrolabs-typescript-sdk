import type { HttpClient } from "../../_internal/http.js";
import type {
  APIKey,
  CreatedAPIKey,
  KeyCreateParams,
  KeyUpdateParams,
  KeyUsageParams,
} from "../../types.js";

export class KeysResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(): Promise<APIKey[]> {
    const data = await this.http.request<
      { data: APIKey[] } | { keys: APIKey[] } | APIKey[]
    >("GET", "/admin/keys");

    if (Array.isArray(data)) return data;
    return (data as { data?: APIKey[]; keys?: APIKey[] }).data
      ?? (data as { keys?: APIKey[] }).keys
      ?? [];
  }

  async retrieve(id: string): Promise<APIKey> {
    return this.http.request<APIKey>("GET", `/admin/keys/${id}`);
  }

  async create(params: KeyCreateParams): Promise<CreatedAPIKey> {
    return this.http.request<CreatedAPIKey>("POST", "/admin/keys", {
      json: params,
    });
  }

  async update(id: string, params: KeyUpdateParams): Promise<APIKey> {
    return this.http.request<APIKey>("PUT", `/admin/keys/${id}`, {
      json: params,
    });
  }

  async delete(id: string): Promise<void> {
    await this.http.request<void>("DELETE", `/admin/keys/${id}`);
  }

  async revoke(id: string): Promise<void> {
    await this.http.request<void>("POST", `/admin/keys/${id}/revoke`);
  }

  async rotate(id: string): Promise<CreatedAPIKey> {
    return this.http.request<CreatedAPIKey>(
      "POST",
      `/admin/keys/${id}/rotate`,
    );
  }

  async usage(params?: KeyUsageParams): Promise<Record<string, unknown>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit !== undefined) queryParams["limit"] = String(params.limit);
    if (params?.offset !== undefined) queryParams["offset"] = String(params.offset);
    if (params?.sort) queryParams["sort"] = params.sort;
    if (params?.active !== undefined) queryParams["active"] = String(params.active);
    if (params?.since) queryParams["since"] = params.since;

    return this.http.request<Record<string, unknown>>(
      "GET",
      "/admin/keys/usage",
      { params: queryParams },
    );
  }
}
