const DEFAULT_BASE_URL = "https://backend.composio.dev/api/v3.1";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ComposioClientOptions {
  apiKey: string;
  readToolAllowlist: readonly string[];
  writeToolAllowlist?: readonly string[];
  baseUrl?: string;
  fetcher?: Fetcher;
}

export interface CreateAuthLinkInput {
  authConfigId: string;
  userId: string;
  alias?: string;
  callbackUrl?: string;
}

export interface ComposioAuthLink {
  link_token: string;
  redirect_url: string;
  expires_at: string;
  connected_account_id: string;
}

export interface ExecuteReadToolInput {
  toolSlug: string;
  version: string;
  connectedAccountId: string;
  userId: string;
  arguments?: Record<string, unknown>;
}

export interface ExecuteActionToolInput extends ExecuteReadToolInput {
  confirmed: boolean;
}

export interface ComposioToolResult {
  data?: unknown;
  error?: string | null;
  successful: boolean;
  log_id?: string;
}

export interface ComposioConnectedAccount {
  id: string;
  user_id: string;
  status: "INITIALIZING" | "INITIATED" | "ACTIVE" | "FAILED" | "EXPIRED" | "INACTIVE" | "REVOKED";
  alias?: string | null;
  toolkit: { slug: string };
}

export interface ComposioConnectedAccountList {
  items: ComposioConnectedAccount[];
  next_cursor?: string | null;
}

export interface ComposioToolkitList {
  items: Array<{ slug: string; name: string; meta?: { description?: string; logo?: string; categories?: Array<{ name?: string; slug?: string }>; tools_count?: number; version?: string } }>;
  next_cursor?: string | null;
}

function requireOpaqueId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || !/^[a-zA-Z0-9_.:@-]+$/.test(normalized)) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

export class ComposioReadOnlyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly readToolAllowlist: ReadonlySet<string>;
  private readonly writeToolAllowlist: ReadonlySet<string>;

  constructor(options: ComposioClientOptions) {
    if (!options.apiKey.trim()) throw new Error("COMPOSIO_API_KEY is required on the server.");
    if (!options.readToolAllowlist.length) throw new Error("At least one reviewed read tool must be allowlisted.");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.readToolAllowlist = new Set(options.readToolAllowlist.map((slug) => slug.toUpperCase()));
    this.writeToolAllowlist = new Set((options.writeToolAllowlist ?? []).map((slug) => slug.toUpperCase()));
  }

  createAuthLink(input: CreateAuthLinkInput) {
    return this.request<ComposioAuthLink>("/connected_accounts/link", {
      method: "POST",
      body: JSON.stringify({
        auth_config_id: requireOpaqueId(input.authConfigId, "auth config ID"),
        user_id: requireOpaqueId(input.userId, "user ID"),
        ...(input.alias ? { alias: input.alias.slice(0, 120) } : {}),
        ...(input.callbackUrl ? { callback_url: new URL(input.callbackUrl).toString() } : {}),
      }),
    });
  }

  executeReadTool(input: ExecuteReadToolInput) {
    const toolSlug = input.toolSlug.toUpperCase();
    if (!this.readToolAllowlist.has(toolSlug)) {
      throw new Error(`Composio tool ${toolSlug} is not in NOVA's reviewed read-only allowlist.`);
    }
    if (!/^\d{8}_\d{2}$/.test(input.version)) {
      throw new Error("Pin a dated Composio tool version before execution.");
    }

    return this.request<ComposioToolResult>(`/tools/execute/${encodeURIComponent(toolSlug)}`, {
      method: "POST",
      body: JSON.stringify({
        connected_account_id: requireOpaqueId(input.connectedAccountId, "connected account ID"),
        user_id: requireOpaqueId(input.userId, "user ID"),
        version: input.version,
        arguments: input.arguments ?? {},
      }),
    });
  }

  listConnectedAccounts(userId: string, includeInactive = false) {
    const query = new URLSearchParams({ limit: "100" });
    query.append("user_ids", requireOpaqueId(userId, "user ID"));
    if (!includeInactive) query.append("statuses", "ACTIVE");
    return this.listAccountPages(query);
  }

  listAllConnectedAccounts(includeInactive = false) {
    const query = new URLSearchParams({ limit: "100" });
    if (!includeInactive) query.append("statuses", "ACTIVE");
    return this.listAccountPages(query);
  }

  listToolkits(query = "", limit = 40) {
    const params = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 100)) });
    if (query.trim()) params.set("search", query.trim().slice(0, 120));
    const toolkitBase = this.baseUrl.replace(/\/v3\.1$/, "/v3");
    return this.requestUrl<ComposioToolkitList>(`${toolkitBase}/toolkits?${params}`, { method: "GET" });
  }

  private async listAccountPages(query: URLSearchParams): Promise<ComposioConnectedAccountList> {
    const items: ComposioConnectedAccount[] = [];
    const cursors = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const result = await this.request<ComposioConnectedAccountList>(`/connected_accounts?${query.toString()}`, { method: "GET" });
      items.push(...result.items);
      if (!result.next_cursor) return { items };
      if (cursors.has(result.next_cursor)) throw new Error("Connection pagination did not complete.");
      cursors.add(result.next_cursor);
      query.set("cursor", result.next_cursor);
    }
    throw new Error("Connection listing exceeded the supported page limit.");
  }

  executeActionTool(input: ExecuteActionToolInput) {
    const toolSlug = input.toolSlug.toUpperCase();
    if (!input.confirmed) throw new Error("Explicit confirmation is required before external execution.");
    if (!this.writeToolAllowlist.has(toolSlug)) throw new Error(`Composio tool ${toolSlug} is not in NOVA's reviewed write allowlist.`);
    if (!/^\d{8}_\d{2}$/.test(input.version)) throw new Error("Pin a dated Composio tool version before execution.");
    return this.request<ComposioToolResult>(`/tools/execute/${encodeURIComponent(toolSlug)}`, {
      method: "POST",
      body: JSON.stringify({ connected_account_id: requireOpaqueId(input.connectedAccountId, "connected account ID"), user_id: requireOpaqueId(input.userId, "user ID"), version: input.version, arguments: input.arguments ?? {} }),
    });
  }

  async revokeConnectedAccount(connectedAccountId: string) {
    await this.request<unknown>(`/connected_accounts/${encodeURIComponent(requireOpaqueId(connectedAccountId, "connected account ID"))}/revoke`, {
      method: "POST",
      body: "{}",
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    return this.requestUrl<T>(`${this.baseUrl}${path}`, init);
  }

  private async requestUrl<T>(url: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(25_000),
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        ...init.headers,
      },
    });

    if (!response.ok) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(`Composio request failed (${response.status})${requestId ? ` [${requestId}]` : ""}.`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifyComposioWebhook(
  headers: Headers,
  rawBody: string,
  secret: string,
  now = new Date(),
  toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
) {
  const webhookId = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!webhookId || !timestamp || !signatureHeader || !secret) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(now.getTime() / 1000 - timestampSeconds) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${webhookId}.${timestamp}.${rawBody}`));
  const expected = bytesToBase64(new Uint8Array(digest));
  const received = signatureHeader.includes(",") ? signatureHeader.slice(signatureHeader.indexOf(",") + 1) : signatureHeader;
  return constantTimeEqual(expected, received);
}
