import type { HttpClient } from "../../_internal/http.js";
import type { ConfigHistoryEntry, GatewayConfig } from "../../types.js";

export class ConfigResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async get(): Promise<GatewayConfig> {
    const data = await this.http.request<Record<string, unknown>>(
      "GET",
      "/admin/config",
    );

    return {
      strategy: (data["strategy"] as Record<string, unknown>) ?? {},
      targets: (data["targets"] as Record<string, unknown>[]) ?? [],
      plugins: (data["plugins"] as Record<string, unknown>[]) ?? [],
      aliases: (data["aliases"] as Record<string, string>) ?? {},
      raw: data,
    };
  }

  async create(
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>(
      "POST",
      "/admin/config",
      { json: config },
    );
  }

  async update(
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>(
      "PUT",
      "/admin/config",
      { json: config },
    );
  }

  async delete(): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>(
      "DELETE",
      "/admin/config",
    );
  }

  async history(): Promise<ConfigHistoryEntry[]> {
    const data = await this.http.request<
      { data: ConfigHistoryEntry[] } | ConfigHistoryEntry[]
    >("GET", "/admin/config/history");

    return Array.isArray(data) ? data : data.data ?? [];
  }

  async rollback(version: number): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>(
      "POST",
      `/admin/config/rollback/${version}`,
    );
  }
}
