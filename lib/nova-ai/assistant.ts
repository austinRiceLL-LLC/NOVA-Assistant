import type { ChatContext, UnifiedMessage } from "./types";
import { answerFromContext } from "./response-generator";
import { getAtlasModelProvider } from "./model-provider";
import { NOVA_SYSTEM_PROMPT } from "./system-prompt";

function compactMessage(message: UnifiedMessage) {
  return { id: message.id, provider: message.source, sender: message.sender, subject: message.subject, timestamp: message.timestamp, content: (message.body || message.preview).slice(0, 3500), canonicalUrl: message.canonicalUrl };
}

export async function answerWithAtlas(question: string, context: ChatContext) {
  const grounded = answerFromContext(question, context);
  const provider = getAtlasModelProvider();
  if (!provider) return { ...grounded, mode: "grounded" as const };
  const referenceIds = new Set(grounded.references.map(item => item.id));
  const selected = context.messages.filter(item => referenceIds.has(item.id) || item.id === context.selectedMessageId);
  const retrieved = (selected.length ? selected : context.messages.slice(0, 6)).slice(0, 8).map(compactMessage);
  const connected = context.connectedApps.map(app => ({ provider: app.provider, label: app.label, capabilities: app.capabilities }));
  const conversation = context.conversation.slice(-10).map(turn => ({ role: turn.role, content: turn.content }));
  const prompt = `USER REQUEST\n${question}\n\nSELECTED OR RETRIEVED APPLICATION CONTEXT\n${JSON.stringify(retrieved)}\n\nCONNECTED CAPABILITIES\n${JSON.stringify(connected)}\n\nRECENT CONVERSATION\n${JSON.stringify(conversation)}\n\nUse the workspace tools when more evidence is needed. Cite application facts only from retrieved context or tool results. Do not claim to perform an external action.`;
  try {
    const referencedIds = new Set(grounded.references.map(item => item.id));
    const text = provider.toolLoop ? await provider.toolLoop({
      system: NOVA_SYSTEM_PROMPT,
      prompt,
      tools: [
        { name: "search_workspace", description: "Search the user's already synchronized workspace messages and records. This is read-only.", parameters: { type: "object", properties: { query: { type: "string" }, provider: { type: ["string", "null"] }, limit: { type: "integer", minimum: 1, maximum: 8 } }, required: ["query", "provider", "limit"], additionalProperties: false } },
        { name: "get_workspace_source", description: "Read one synchronized workspace source by its exact id. This is read-only.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
      ],
      async execute(name, argumentsValue) {
        const args = argumentsValue && typeof argumentsValue === "object" ? argumentsValue as Record<string, unknown> : {};
        if (name === "get_workspace_source") {
          const item = context.messages.find(message => message.id === args.id);
          if (!item) return { found: false };
          referencedIds.add(item.id);
          return { found: true, source: compactMessage(item) };
        }
        if (name === "search_workspace") {
          const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
          const providerName = typeof args.provider === "string" ? args.provider.toLowerCase() : "";
          const limit = Math.min(8, Math.max(1, Number(args.limit) || 5));
          const matches = context.messages.filter(item => {
            if (providerName && item.source.toLowerCase() !== providerName) return false;
            const haystack = `${item.sender.name || ""} ${item.sender.address || ""} ${item.subject || ""} ${item.preview} ${item.body || ""}`.toLowerCase();
            return !query || haystack.includes(query);
          }).slice(0, limit);
          matches.forEach(item => referencedIds.add(item.id));
          return { count: matches.length, results: matches.map(compactMessage) };
        }
        return { error: "Unknown tool." };
      },
    }) : await provider.generate({ system: NOVA_SYSTEM_PROMPT, prompt });
    const references = context.messages.filter(item => referencedIds.has(item.id)).map(item => ({ id: item.id, title: item.subject || item.preview.slice(0, 72), source: item.source }));
    return { text, references, mode: "model" as const };
  }
  catch { return { ...grounded, mode: "grounded" as const }; }
}

export async function draftWithAtlas(input: { senderName?: string; subject?: string; body: string; tone?: string; instruction?: string }) {
  const provider = getAtlasModelProvider();
  if (!provider) return null;
  const prompt = `Write an email reply draft.\nSender: ${input.senderName || "Unknown"}\nSubject: ${input.subject || "No subject"}\nRequested tone: ${input.tone || "professional but friendly"}\nUser instruction: ${input.instruction || "Respond appropriately to the message"}\nOriginal message:\n${input.body.slice(0, 8000)}\n\nReturn JSON with recipientName, subject, and body. Do not invent dates, commitments, or availability.`;
  return provider.generateStructured({ system: NOVA_SYSTEM_PROMPT, prompt, validate(value) { const item = value as Record<string, unknown>; if (typeof item.subject !== "string" || typeof item.body !== "string") throw new Error("Invalid draft response."); return { recipient: typeof item.recipientName === "string" ? item.recipientName : input.senderName || "Recipient", subject: item.subject, body: item.body }; } });
}
