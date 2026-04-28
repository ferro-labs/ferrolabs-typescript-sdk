import type { HttpClient } from "../../_internal/http.js";

export class PluginsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(): Promise<Record<string, unknown>[]> {
    const data = await this.http.request<
      { data: Record<string, unknown>[] } | Record<string, unknown>[]
    >("GET", "/admin/plugins");

    return Array.isArray(data) ? data : (data.data ?? []);
  }
}
