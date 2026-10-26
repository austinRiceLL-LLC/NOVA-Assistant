import type { ChatContext, UnifiedMessage } from "./types.ts";
import { parseSourceTitle } from "./source-title.ts";

type WorkspaceSource = { id: string; externalId?: string; title: string; content: string; summary: string; sourceType: string; provider: string; accountLabel: string; occurredAt: number; canonicalUrl: string | null };
type WorkspaceConnection = { id: string; provider: string; label: string; status: string };

export function workspaceToChatContext(input: { page?: string; selectedMessageId?: string; conversation?: ChatContext["conversation"]; sources: WorkspaceSource[]; connections: WorkspaceConnection[] }): ChatContext {
  const messages: UnifiedMessage[] = input.sources.map((source) => ({
    id: source.id, externalId: source.externalId ?? source.id, source: source.provider, accountId: input.connections.find((item) => item.provider === source.provider)?.id,
    sender: { name: parseSourceTitle(source.title, source.provider).sender, address: parseSourceTitle(source.title, source.provider).address }, subject: parseSourceTitle(source.title).subject,
    preview: source.summary, body: source.content, timestamp: new Date(source.occurredAt).toISOString(), unread: false, metadata: { sourceType: source.sourceType },
    canonicalUrl: source.canonicalUrl ?? undefined,
  }));
  return { page: input.page ?? "/", messages, selectedMessageId: input.selectedMessageId, conversation: input.conversation ?? [], connectedApps: input.connections.filter((item) => item.status === "active").map((item) => ({ provider: item.provider, accountId: item.id, label: item.label, capabilities: item.provider === "gmail" || item.provider === "outlook" ? ["read", "search", "draft"] : ["read"] })) };
}
