import type { HttpClient } from "../../_internal/http.js";
import type {
  LogDeleteParams,
  LogListParams,
  LogStatsParams,
} from "../../types.js";

export class LogsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(params?: LogListParams): Promise<Record<string, unknown>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit !== undefined)
      queryParams["limit"] = String(params.limit);
    if (params?.offset !== undefined)
      queryParams["offset"] = String(params.offset);
    if (params?.stage) queryParams["stage"] = params.stage;
    if (params?.provider) queryParams["provider"] = params.provider;
    if (params?.model) queryParams["model"] = params.model;
    if (params?.since) queryParams["since"] = params.since;

    return this.http.request<Record<string, unknown>>("GET", "/admin/logs", {
      params: queryParams,
    });
  }

  async stats(params?: LogStatsParams): Promise<Record<string, unknown>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit !== undefined)
      queryParams["limit"] = String(params.limit);
    if (params?.since) queryParams["since"] = params.since;
    if (params?.stage) queryParams["stage"] = params.stage;
    if (params?.provider) queryParams["provider"] = params.provider;
    if (params?.model) queryParams["model"] = params.model;

    return this.http.request<Record<string, unknown>>(
      "GET",
      "/admin/logs/stats",
      { params: queryParams },
    );
  }

  async delete(params?: LogDeleteParams): Promise<Record<string, unknown>> {
    const queryParams: Record<string, string> = {};
    if (params?.before) queryParams["before"] = params.before;
    if (params?.stage) queryParams["stage"] = params.stage;
    if (params?.provider) queryParams["provider"] = params.provider;
    if (params?.model) queryParams["model"] = params.model;

    return this.http.request<Record<string, unknown>>("DELETE", "/admin/logs", {
      params: queryParams,
    });
  }
}
