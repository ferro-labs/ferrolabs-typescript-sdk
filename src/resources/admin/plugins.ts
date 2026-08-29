import type { HttpClient } from "../../_internal/http.js";
import type { PluginCatalogEntry } from "../../types.js";

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

  /** `GET /admin/plugins/catalog` — built-in plugins this gateway can run. */
  async catalog(): Promise<PluginCatalogEntry[]> {
    const data = await this.http.request<{ data?: PluginCatalogEntry[] }>(
      "GET",
      "/admin/plugins/catalog",
    );
    return data.data ?? [];
  }
}
