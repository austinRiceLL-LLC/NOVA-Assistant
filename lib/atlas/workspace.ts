import { analyzeMessage } from "../nova-ai/message-intelligence.ts";
import type { MessageIntelligence } from "../nova-ai/types.ts";
import { parseSourceTitle } from "../nova-ai/source-title.ts";

export type Provider = string;
export type ConnectionStatus = "connecting" | "connected" | "syncing" | "attention" | "disconnected" | "error";
export type WorkspaceView = "home" | "inbox" | "chat" | "calendar" | "knowledge" | "activity" | "apps" | "settings";
export interface Source {
  id: string; externalId?: string; title: string; content: string; summary: string;
  sourceType: string; provider: string; accountLabel: string; canonicalUrl: string | null;
  labels: string[]; occurredAt: number; updatedAt: number; summaryStrategy: string; modelCallCount: number;
}
export interface Connection {
  id: string; provider: string; label: string; status: string; lastSyncAt: number | null;
  capabilities?: string[];
}
export interface WorkspaceData {
  user: { displayName: string; email: string }; sources: Source[]; connections: Connection[];
  briefing: string; demo?: boolean;
  budget: { summaryMode: string; dailyModelCallLimit: number; batchSize: number; onlyProcessChangedContent: boolean; modelCallsInView: number; unchangedItemsSkipped: number };
}
export interface Reference { id: string; title: string; source: string; summary: string; priority: string; why: string; requiresResponse: boolean; canonicalUrl?: string }
export interface ChatTurn { id: string; role: "user" | "assistant"; text: string; references?: Reference[] }
export interface Activity { id: string; text: string; at: number; kind: "success" | "error" | "info" }

export const PROVIDERS: Array<{ id: Provider; name: string; description: string }> = [
  { id: "gmail", name: "Gmail", description: "Read email, draft replies, and send after your confirmation." },
  { id: "linkedin", name: "LinkedIn", description: "Your approved profile and organization information." },
  { id: "outlook", name: "Outlook", description: "Email connection. Automatic sync is paused while the provider issue is resolved." },
];
export const SYNC_INTERVAL = 10 * 60_000;
export function connectionStatus(status?: string): ConnectionStatus {
  if (status === "active" || status === "connected") return "connected";
  if (status === "connecting" || status === "INITIATED" || status === "INITIALIZING") return "connecting";
  if (["expired", "revoked", "inactive", "attention"].includes((status ?? "").toLowerCase())) return "attention";
  if (status === "failed" || status === "error") return "error";
  return "disconnected";
}
export function syncCandidates(connections: Connection[], now = Date.now(), force = false) {
  return connections.filter(c => c.status === "active" && (c.provider === "gmail" || c.provider === "linkedin") && (force || !c.lastSyncAt || now - c.lastSyncAt >= SYNC_INTERVAL));
}
export function sourceIntelligence(source: Source): MessageIntelligence {
  return analyzeMessage({ id: source.id, externalId: source.externalId ?? source.id, source: source.provider,
    sender: { name: parseSourceTitle(source.title, source.accountLabel).sender, address: parseSourceTitle(source.title).address }, subject: parseSourceTitle(source.title).subject, preview: source.summary,
    body: source.content, timestamp: new Date(source.occurredAt).toISOString(), unread: false });
}
export function buildBriefing(sources: Source[]) {
  const { messages, ranked, important, remaining } = rankInboxSources(sources);
  const attention = ranked.filter(item => !item.intelligence.isAutomated && (item.intelligence.requiresResponse || ["high", "critical"].includes(item.intelligence.priority)));
  const replies = ranked.filter(item => item.intelligence.requiresResponse).length;
  const text = !messages.length ? "Your workspace is ready. Connect an account to see what deserves your attention."
    : attention.length ? `${attention.length === 1 ? "One message may need" : `${attention.length} messages may need`} your attention.${replies ? ` ${replies === 1 ? "One looks" : `${replies} look`} like ${replies === 1 ? "it needs a reply" : "they need replies"}.` : " Start with the items below."}`
    : "No urgent signals in your saved messages. Take a breath, then choose what to work on.";
  return { text, ranked, important, remaining, attention, replies, suggestions: replies ? ["What should I handle first?", "Which messages need replies?", "Summarize my inbox"] : ["Summarize my inbox", "Find interview messages", "Review my saved knowledge"] };
}
export function rankInboxSources(sources: Source[]) {
  const messages = sources.filter(source => source.sourceType === "email" || source.sourceType === "message");
  const ranked = messages.map(source => ({ source, intelligence: sourceIntelligence(source) }))
    .sort((a, b) => b.intelligence.priorityScore - a.intelligence.priorityScore || b.source.occurredAt - a.source.occurredAt);
  const important = ranked.filter(item => !item.intelligence.isAutomated && item.intelligence.priorityScore >= 62).slice(0, 5);
  const importantIds = new Set(important.map(item => item.source.id));
  const remaining = ranked.filter(item => !importantIds.has(item.source.id));
  return { messages, ranked, important, remaining };
}
export function relativeTime(value: number | null, now = Date.now()) {
  if (!value) return "Not synced yet";
  const minutes = Math.max(0, Math.floor((now - value) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
export function safeSourceUrl(value?: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
