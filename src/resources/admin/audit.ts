import type { HttpClient } from "../../_internal/http.js";
import type { AuditListParams, AuditListResponse } from "../../types.js";

export class AuditResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** `GET /admin/audit` — 501 unless the gateway has an audit store. */
  async list(params?: AuditListParams): Promise<AuditListResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.action) queryParams["action"] = params.action;
    if (params?.actor_id) queryParams["actor_id"] = params.actor_id;
    if (params?.outcome) queryParams["outcome"] = params.outcome;
    if (params?.since) queryParams["since"] = params.since;
    if (params?.limit !== undefined)
      queryParams["limit"] = String(params.limit);
    if (params?.offset !== undefined)
      queryParams["offset"] = String(params.offset);

    return this.http.request<AuditListResponse>("GET", "/admin/audit", {
      params: queryParams,
    });
  }
}
