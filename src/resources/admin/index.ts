import type { HttpClient } from "../../_internal/http.js";
import { ConfigResource } from "./config.js";
import { KeysResource } from "./keys.js";
import { LogsResource } from "./logs.js";
import { PluginsResource } from "./plugins.js";
import { ProvidersResource } from "./providers.js";

export class Admin {
  readonly keys: KeysResource;
  readonly config: ConfigResource;
  readonly logs: LogsResource;
  readonly providers: ProvidersResource;
  readonly plugins: PluginsResource;

  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
    this.keys = new KeysResource(http);
    this.config = new ConfigResource(http);
    this.logs = new LogsResource(http);
    this.providers = new ProvidersResource(http);
    this.plugins = new PluginsResource(http);
  }

  async dashboard(): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>(
      "GET",
      "/admin/dashboard",
    );
  }

  async health(): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>("GET", "/admin/health");
  }
}
