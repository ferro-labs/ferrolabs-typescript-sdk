// ---------------------------------------------------------------------------
// Admin: Keys
// ---------------------------------------------------------------------------

export interface APIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  active: boolean;
  created_at: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  usage_count: number;
  revoked_at?: string | null;
  rotated_at?: string | null;
}

export interface CreatedAPIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  active: boolean;
  created_at: string;
  expires_at?: string | null;
}

export interface KeyCreateParams {
  name: string;
  scopes?: string[];
  expires_at?: string;
}

export interface KeyUpdateParams {
  name?: string;
  scopes?: string[];
  expires_at?: string;
  active?: boolean;
  clear_expiration?: boolean;
}

export interface KeyUsageParams {
  limit?: number;
  offset?: number;
  sort?: "usage" | "last_used";
  active?: boolean;
  since?: string;
}

// ---------------------------------------------------------------------------
// Admin: Config
// ---------------------------------------------------------------------------

export interface GatewayConfig {
  strategy: Record<string, unknown>;
  targets: Record<string, unknown>[];
  plugins: Record<string, unknown>[];
  aliases: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface ConfigHistoryEntry {
  version: number;
  config: Record<string, unknown>;
  updated_at: string;
  rolled_back_from?: number | null;
}

// ---------------------------------------------------------------------------
// Admin: Logs
// ---------------------------------------------------------------------------

export interface LogListParams {
  limit?: number;
  offset?: number;
  /** Default: terminal rows only. `"all"` includes every stage. */
  stage?: string;
  provider?: string;
  model?: string;
  since?: string;
  /** Filter by key id; `"none"` selects unauthenticated rows. */
  api_key_id?: string;
}

export interface LogStatsParams {
  limit?: number;
  since?: string;
  stage?: string;
  provider?: string;
  model?: string;
  /** Add a time series with this many buckets. */
  buckets?: number;
}

export interface LogDeleteParams {
  before?: string;
  stage?: string;
  provider?: string;
  model?: string;
}

// ---------------------------------------------------------------------------
// Admin: Audit
// ---------------------------------------------------------------------------

export interface AuditListParams {
  action?: string;
  actor_id?: string;
  outcome?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface AuditEntry {
  occurred_at: string;
  action: string;
  actor: string;
  actor_id: string;
  target_id?: string;
  outcome: string;
  detail?: string;
  source_ip?: string;
  trace_id?: string;
}

export interface AuditListResponse {
  data: AuditEntry[];
  summary: { total_entries: number; returned_entries: number };
  filters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Admin: Catalogs
// ---------------------------------------------------------------------------

export interface ProviderCatalogEntry {
  id: string;
  registered: boolean;
  catalog_models: number;
}

export interface PluginCatalogEntry {
  name: string;
  type: string;
  summary?: string;
  settings?: string[];
  fails_open?: boolean;
}
