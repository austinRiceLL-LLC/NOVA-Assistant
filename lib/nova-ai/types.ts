export type MessagePriority = "critical" | "high" | "normal" | "low";
export type MessageCategory = "work" | "school" | "recruiting" | "personal" | "finance" | "notification" | "newsletter" | "meeting" | "task" | "other";
export type ThreadState = "WAITING_ON_USER" | "WAITING_ON_OTHER" | "RESOLVED" | "INFORMATIONAL";
export type ActionRisk = "READ_ONLY" | "LOW_RISK" | "COMMUNICATION" | "HIGH_IMPACT";
export type NovaIntent = "SEARCH_MESSAGES" | "FETCH_THREAD" | "DRAFT_REPLY" | "SEND_REPLY" | "ARCHIVE_MESSAGE" | "MARK_READ" | "SEARCH_CALENDAR" | "CREATE_CALENDAR_EVENT" | "CREATE_TASK";

export interface UnifiedMessage {
  id: string;
  externalId: string;
  source: string;
  accountId?: string;
  threadId?: string;
  sender: { id?: string; name?: string; address?: string; avatar?: string };
  recipients?: Array<{ name?: string; address: string }>;
  subject?: string;
  preview: string;
  body?: string;
  timestamp: string;
  unread: boolean;
  canonicalUrl?: string;
  metadata?: Record<string, unknown>;
  intelligence?: MessageIntelligence;
}

export interface MessageIntelligence {
  summary: string;
  priority: MessagePriority;
  priorityScore: number;
  confidence: number;
  category: MessageCategory;
  intent?: string;
  requiresResponse: boolean;
  responseRecommended: boolean;
  deadline?: string;
  actionItems: string[];
  people: string[];
  organizations: string[];
  sentiment?: string;
  isAutomated: boolean;
  suggestedActions: NovaIntent[];
  explanation: string;
  threadState: ThreadState;
}

export interface NovaActionProposal {
  id: string;
  intent: NovaIntent;
  risk: ActionRisk;
  accountId: string;
  targetId: string;
  summary: string;
  arguments: Record<string, unknown>;
  status: "proposed" | "confirmed" | "executing" | "succeeded" | "failed" | "cancelled";
}

export interface ChatContext {
  page: string;
  selectedMessageId?: string;
  messages: UnifiedMessage[];
  connectedApps: Array<{ provider: string; accountId: string; label: string; capabilities: string[] }>;
  conversation: Array<{ role: "user" | "assistant"; content: string; referencedMessageIds?: string[] }>;
  pendingAction?: NovaActionProposal;
}

export interface AIProvider {
  generate(input: { system: string; prompt: string }): Promise<string>;
  stream(input: { system: string; prompt: string }): AsyncIterable<string>;
  generateStructured<T>(input: { system: string; prompt: string; validate(value: unknown): T }): Promise<T>;
  toolLoop?(input: { system: string; prompt: string; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>; execute(name: string, argumentsValue: unknown): Promise<unknown> }): Promise<string>;
}
