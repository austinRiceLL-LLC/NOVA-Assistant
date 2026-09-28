import { env } from "cloudflare:workers";
import { summarizeCollection, summarizeWithoutModel } from "./summarize";

export type NovaUser = {
  userId: string;
  email: string;
  displayName: string;
};

export type SupportedCloudProvider = "gmail" | "outlook" | "linkedin";

export type WorkspaceSource = {
  id: string;
  externalId?: string;
  title: string;
  content: string;
  summary: string;
  sourceType: string;
  provider: string;
  accountLabel: string;
  canonicalUrl: string | null;
  labels: string[];
  occurredAt: number;
  updatedAt: number;
  summaryStrategy: string;
  modelCallCount: number;
};

export type WorkspaceConnection = {
  id: string;
  provider: string;
  label: string;
  status: string;
  externalAccountId: string | null;
  lastSyncAt: number | null;
};

export type RemoteKnowledgeItem = {
  externalId: string;
  title: string;
  content: string;
  occurredAt: number;
  canonicalUrl?: string | null;
};

const DEFAULT_PREFERENCES = {
  summaryMode: "efficient",
  dailyModelCallLimit: 20,
  batchSize: 25,
  onlyProcessChangedContent: true,
};

function getDatabase() {
  const runtime = env as unknown as { DB?: D1Database };
  if (!runtime.DB) throw new Error("NOVA storage is temporarily unavailable.");
  return runtime.DB;
}

function connectionId(userId: string, provider: string) {
  return `connector:${provider}:${userId}`;
}

function manualConnectionId(userId: string) {
  return connectionId(userId, "manual");
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ensureUser(user: NovaUser) {
  const now = Date.now();
  await getDatabase().prepare(`
    INSERT INTO user_profiles (
      id, email, display_name, timezone, preferences_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
  `).bind(
    user.userId,
    user.email,
    user.displayName,
    "America/New_York",
    JSON.stringify(DEFAULT_PREFERENCES),
    now,
    now,
  ).run();
}

export async function loadWorkspace(user: NovaUser, query = "") {
  await ensureUser(user);
  const db = getDatabase();
  const normalizedQuery = query.trim().slice(0, 100);
  const like = `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`;
  const sourceSql = `
    SELECT
      s.id, s.external_id, s.title, s.content, s.summary, s.source_type, s.canonical_url,
      s.labels_json, s.occurred_at, s.updated_at, s.summary_strategy,
      s.model_call_count, c.provider, c.label AS account_label
    FROM source_items s
    JOIN connector_accounts c ON c.id = s.connector_account_id
    WHERE s.user_id = ?
      ${normalizedQuery ? "AND (s.title LIKE ? ESCAPE '\\\\' OR s.content LIKE ? ESCAPE '\\\\' OR s.summary LIKE ? ESCAPE '\\\\')" : ""}
    ORDER BY s.updated_at DESC
    LIMIT 100
  `;
  const sourceStatement = normalizedQuery
    ? db.prepare(sourceSql).bind(user.userId, like, like, like)
    : db.prepare(sourceSql).bind(user.userId);

  const [sourceResult, connectionResult, profileResult] = await Promise.all([
    sourceStatement.all<Record<string, unknown>>(),
    db.prepare(`
      SELECT id, provider, label, status, external_account_id, last_sync_at
      FROM connector_accounts
      WHERE user_id = ? AND provider != 'manual'
      ORDER BY created_at ASC
    `).bind(user.userId).all<Record<string, unknown>>(),
    db.prepare("SELECT preferences_json FROM user_profiles WHERE id = ?")
      .bind(user.userId).first<{ preferences_json: string }>(),
  ]);

  const sources: WorkspaceSource[] = sourceResult.results.map((row) => ({
    id: String(row.id),
    externalId: String(row.external_id),
    title: String(row.title),
    content: String(row.content ?? ""),
    summary: String(row.summary),
    sourceType: String(row.source_type),
    provider: String(row.provider),
    accountLabel: String(row.account_label),
    canonicalUrl: row.canonical_url ? String(row.canonical_url) : null,
    labels: parseStringArray(String(row.labels_json ?? "[]")),
    occurredAt: Number(row.occurred_at),
    updatedAt: Number(row.updated_at),
    summaryStrategy: String(row.summary_strategy ?? "extractive"),
    modelCallCount: Number(row.model_call_count ?? 0),
  }));
  const connections: WorkspaceConnection[] = connectionResult.results.map((row) => ({
    id: String(row.id),
    provider: String(row.provider),
    label: String(row.label),
    status: String(row.status),
    externalAccountId: row.external_account_id ? String(row.external_account_id) : null,
    lastSyncAt: row.last_sync_at === null || row.last_sync_at === undefined ? null : Number(row.last_sync_at),
  }));

  let preferences = DEFAULT_PREFERENCES;
  try {
    preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(profileResult?.preferences_json ?? "{}") };
  } catch {
    preferences = DEFAULT_PREFERENCES;
  }

  return {
    user: { displayName: user.displayName, email: user.email },
    sources,
    connections,
    briefing: summarizeCollection(sources),
    budget: {
      ...preferences,
      modelCallsInView: sources.reduce((total, source) => total + source.modelCallCount, 0),
      unchangedItemsSkipped: sources.filter((source) => source.modelCallCount === 0).length,
    },
  };
}

export async function saveManualSource(user: NovaUser, input: { title?: string; content: string; sourceType: string }) {
  const content = input.content.replace(/\0/g, "").trim().slice(0, 20_000);
  if (!content) throw new Error("Add some information before saving.");
  const now = Date.now();
  const summary = summarizeWithoutModel(content);
  const id = crypto.randomUUID();
  const externalId = crypto.randomUUID();
  const title = (input.title?.trim() || content.split(/\r?\n/)[0] || "Untitled note").slice(0, 180);
  const sourceType = ["note", "email", "meeting", "linkedin", "research", "document"].includes(input.sourceType)
    ? input.sourceType
    : "note";
  const db = getDatabase();
  await ensureUser(user);
  await db.batch([
    db.prepare(`
      INSERT INTO connector_accounts (
        id, user_id, provider, label, external_account_id, status, permission_level,
        granted_capabilities_json, connection_reference, last_sync_at, created_at, updated_at
      ) VALUES (?, ?, 'manual', 'Quick capture', 'manual', 'active', 'observe', ?, NULL, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
    `).bind(manualConnectionId(user.userId), user.userId, JSON.stringify(["documents.read"]), now, now, now),
    db.prepare(`
      INSERT INTO source_items (
        id, user_id, connector_account_id, source_type, external_id, title, content,
        summary, summary_strategy, model_call_count, sensitivity, occurred_at, due_at,
        starts_at, ends_at, canonical_url, labels_json, participants_json, metadata_json,
        content_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'extractive', 0, 'personal', ?, NULL, NULL, NULL, NULL, ?, '[]', ?, ?, ?, ?)
    `).bind(
      id,
      user.userId,
      manualConnectionId(user.userId),
      sourceType,
      externalId,
      title,
      content,
      summary.summary,
      now,
      JSON.stringify(summary.tags),
      JSON.stringify({ keyPoints: summary.keyPoints, capturedBy: "user" }),
      await sha256(content),
      now,
      now,
    ),
    db.prepare(`
      INSERT INTO audit_entries (
        id, user_id, connector_account_id, action, target_type, target_id, outcome,
        requires_approval, metadata_json, created_at
      ) VALUES (?, ?, ?, 'knowledge.capture', 'source_item', ?, 'success', 0, ?, ?)
    `).bind(crypto.randomUUID(), user.userId, manualConnectionId(user.userId), id, JSON.stringify({ sourceType }), now),
  ]);
  return { id, summary: summary.summary, tags: summary.tags };
}

export async function deleteSource(userId: string, sourceId: string) {
  const db = getDatabase();
  const result = await db.prepare("DELETE FROM source_items WHERE id = ? AND user_id = ?")
    .bind(sourceId, userId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getSourceForAction(userId: string, sourceId: string) {
  return getDatabase().prepare(`
    SELECT s.id, s.external_id, s.connector_account_id, c.provider
    FROM source_items s
    JOIN connector_accounts c ON c.id = s.connector_account_id
    WHERE s.id = ? AND s.user_id = ?
  `).bind(sourceId, userId).first<{ id: string; external_id: string; connector_account_id: string; provider: string }>();
}

export async function savePendingConnection(
  user: NovaUser,
  provider: string,
  externalAccountId: string,
  displayName?: string,
) {
  const now = Date.now();
  const capabilities = provider === "linkedin" ? ["professional.read"] : ["email.read"];
  await ensureUser(user);
  await getDatabase().prepare(`
    INSERT INTO connector_accounts (
      id, user_id, provider, label, external_account_id, status, permission_level,
      granted_capabilities_json, connection_reference, last_sync_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'connecting', 'observe', ?, ?, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      external_account_id = excluded.external_account_id,
      status = 'connecting',
      granted_capabilities_json = excluded.granted_capabilities_json,
      connection_reference = excluded.connection_reference,
      updated_at = excluded.updated_at
  `).bind(
    connectionId(user.userId, provider),
    user.userId,
    provider,
    displayName?.slice(0, 120) || (provider === "gmail" ? "Gmail" : provider === "outlook" ? "Outlook" : provider === "linkedin" ? "LinkedIn" : provider),
    externalAccountId,
    JSON.stringify(capabilities),
    externalAccountId,
    now,
    now,
  ).run();
}

export async function saveDiscoveredConnection(
  user: NovaUser,
  provider: string,
  externalAccountId: string,
  displayName?: string,
) {
  const now = Date.now();
  const capabilities = provider === "linkedin" ? ["professional.read"] : ["email.read", "email.draft", "email.send"];
  await ensureUser(user);
  await getDatabase().prepare(`
    INSERT INTO connector_accounts (
      id, user_id, provider, label, external_account_id, status, permission_level,
      granted_capabilities_json, connection_reference, last_sync_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', 'suggest', ?, ?, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      external_account_id = excluded.external_account_id,
      status = 'active',
      granted_capabilities_json = excluded.granted_capabilities_json,
      connection_reference = excluded.connection_reference,
      updated_at = excluded.updated_at
  `).bind(
    connectionId(user.userId, provider), user.userId, provider,
    displayName?.slice(0, 120) || (provider === "gmail" ? "Gmail" : provider === "outlook" ? "Outlook" : provider === "linkedin" ? "LinkedIn" : provider),
    externalAccountId, JSON.stringify(capabilities), externalAccountId, now, now,
  ).run();
}

export async function getConnection(userId: string, provider: SupportedCloudProvider) {
  return getDatabase().prepare(`
    SELECT id, external_account_id, status
    FROM connector_accounts
    WHERE id = ? AND user_id = ? AND provider = ?
  `).bind(connectionId(userId, provider), userId, provider)
    .first<{ id: string; external_account_id: string | null; status: string }>();
}

export async function updateConnectionStatus(userId: string, provider: SupportedCloudProvider, status: string) {
  await getDatabase().prepare("UPDATE connector_accounts SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(status, Date.now(), connectionId(userId, provider), userId).run();
}

export async function saveRemoteItems(
  user: NovaUser,
  provider: SupportedCloudProvider,
  items: RemoteKnowledgeItem[],
) {
  const db = getDatabase();
  const now = Date.now();
  const accountId = connectionId(user.userId, provider);
  const statements = [];
  for (const item of items.slice(0, 50)) {
    const content = item.content.replace(/\0/g, "").trim().slice(0, 20_000);
    const compact = summarizeWithoutModel(content || item.title);
    const hash = await sha256(content || item.title);
    statements.push(db.prepare(`
      INSERT INTO source_items (
        id, user_id, connector_account_id, source_type, external_id, title, content,
        summary, summary_strategy, model_call_count, sensitivity, occurred_at, due_at,
        starts_at, ends_at, canonical_url, labels_json, participants_json, metadata_json,
        content_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'extractive', 0, 'confidential', ?, NULL, NULL, NULL, ?, ?, '[]', ?, ?, ?, ?)
      ON CONFLICT(connector_account_id, external_id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        summary = CASE WHEN source_items.content_hash = excluded.content_hash THEN source_items.summary ELSE excluded.summary END,
        labels_json = excluded.labels_json,
        metadata_json = excluded.metadata_json,
        content_hash = excluded.content_hash,
        canonical_url = excluded.canonical_url,
        occurred_at = excluded.occurred_at,
        updated_at = excluded.updated_at
    `).bind(
      crypto.randomUUID(),
      user.userId,
      accountId,
      provider === "linkedin" ? "linkedin" : "email",
      item.externalId.slice(0, 300),
      item.title.slice(0, 300),
      content,
      compact.summary,
      item.occurredAt,
      item.canonicalUrl ?? null,
      JSON.stringify(compact.tags),
      JSON.stringify({ keyPoints: compact.keyPoints, importedBy: "composio" }),
      hash,
      now,
      now,
    ));
  }
  statements.push(db.prepare(`
    UPDATE connector_accounts
    SET status = 'active', last_sync_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, now, accountId, user.userId));
  statements.push(db.prepare(`
    INSERT INTO audit_entries (
      id, user_id, connector_account_id, action, target_type, target_id, outcome,
      requires_approval, metadata_json, created_at
    ) VALUES (?, ?, ?, 'connector.sync', 'connector_account', ?, 'success', 0, ?, ?)
  `).bind(crypto.randomUUID(), user.userId, accountId, accountId, JSON.stringify({ provider, itemCount: items.length }), now));
  await db.batch(statements);
  return items.length;
}
