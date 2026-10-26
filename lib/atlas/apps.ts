export type AppCategory = "Communication" | "Productivity" | "Developer" | "Files" | "CRM" | "Social" | "Finance" | "Project Management" | "Marketing" | "Other";

export interface AppCapability {
  toolkitId: string;
  provider: string;
  displayName: string;
  description: string;
  logo?: string;
  categories: AppCategory[];
  connected: boolean;
  connectable: boolean;
  searchable: boolean;
  readable: boolean;
  writable: boolean;
  supportsReply: boolean;
  supportsSend: boolean;
  supportsCreate: boolean;
  supportsUpdate: boolean;
  supportsDelete: boolean;
  availableTools: string[];
  toolsCount: number;
  version?: string;
}

export interface ComposioToolkit {
  slug: string;
  name: string;
  meta?: { description?: string; logo?: string; categories?: Array<{ name?: string; slug?: string }>; tools_count?: number; version?: string };
}

const CATEGORY_MAP: Array<[RegExp, AppCategory]> = [
  [/communication|messaging|email/, "Communication"], [/developer|engineering/, "Developer"], [/file|storage|document/, "Files"],
  [/crm|customer/, "CRM"], [/social/, "Social"], [/finance|accounting|payment/, "Finance"], [/project|task/, "Project Management"], [/marketing/, "Marketing"], [/productivity|calendar/, "Productivity"],
];

export function normalizeCategory(value = ""): AppCategory {
  return CATEGORY_MAP.find(([pattern]) => pattern.test(value.toLowerCase()))?.[1] ?? "Other";
}

export function inferCapabilities(tools: string[]) {
  const text = tools.join(" ").toLowerCase();
  return {
    searchable: /search|list|find|query/.test(text), readable: /get|read|fetch|search|list/.test(text),
    writable: /send|create|update|delete|archive|reply|post|write/.test(text), supportsReply: /reply/.test(text), supportsSend: /send|post/.test(text),
    supportsCreate: /create/.test(text), supportsUpdate: /update|edit/.test(text), supportsDelete: /delete|remove|archive|trash/.test(text),
  };
}

export function toolkitToCapability(toolkit: ComposioToolkit, input: { connected?: boolean; connectable?: boolean; tools?: string[] } = {}): AppCapability {
  const tools = input.tools ?? [];
  const inferred = inferCapabilities(tools);
  const categories = [...new Set((toolkit.meta?.categories ?? []).map(item => normalizeCategory(item.name ?? item.slug)))];
  return { toolkitId: toolkit.slug, provider: toolkit.slug.toLowerCase(), displayName: toolkit.name || toolkit.slug, description: toolkit.meta?.description || `Connect ${toolkit.name || toolkit.slug} to use its approved tools in Atlas.`, logo: toolkit.meta?.logo,
    categories: categories.length ? categories : ["Other"], connected: Boolean(input.connected), connectable: Boolean(input.connectable), ...inferred,
    availableTools: tools, toolsCount: Number(toolkit.meta?.tools_count ?? tools.length), version: toolkit.meta?.version };
}

export function rankApps(apps: AppCapability[], query: string, connectedProviders: string[] = []) {
  const normalized = query.trim().toLowerCase();
  const connected = new Set(connectedProviders.map(item => item.toLowerCase()));
  return [...apps].sort((left, right) => {
    const score = (app: AppCapability) => (connected.has(app.provider) ? 30 : 0) + (normalized && app.provider === normalized ? 100 : 0) + (normalized && app.displayName.toLowerCase() === normalized ? 90 : 0) + (normalized && app.displayName.toLowerCase().startsWith(normalized) ? 60 : 0) + (normalized && `${app.displayName} ${app.description}`.toLowerCase().includes(normalized) ? 25 : 0) + Math.min(app.toolsCount, 20);
    return score(right) - score(left) || left.displayName.localeCompare(right.displayName);
  });
}
