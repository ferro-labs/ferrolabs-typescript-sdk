import type { HttpClient } from "../../_internal/http.js";
import type { ProviderCatalogEntry } from "../../types.js";

export class ProvidersResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(): Promise<Record<string, unknown>[]> {
    const data = await this.http.request<
      { data: Record<string, unknown>[] } | Record<string, unknown>[]
    >("GET", "/admin/providers");

    return Array.isArray(data) ? data : (data.data ?? []);
  }

  /** `GET /admin/providers/catalog` — every provider the build knows. */
  async catalog(): Promise<ProviderCatalogEntry[]> {
    const data = await this.http.request<{
      providers?: ProviderCatalogEntry[];
    }>("GET", "/admin/providers/catalog");
    return data.providers ?? [];
  }
}
