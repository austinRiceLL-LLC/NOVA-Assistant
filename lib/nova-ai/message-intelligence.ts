import { scoreMessage } from "./prioritization.ts";
import type { MessageCategory, MessageIntelligence, UnifiedMessage } from "./types.ts";

function categoryFor(text: string): MessageCategory {
  if (/recruit|interview|application|hiring/i.test(text)) return "recruiting";
  if (/invoice|payment|bank|receipt|subscription/i.test(text)) return "finance";
  if (/class|course|professor|assignment|campus/i.test(text)) return "school";
  if (/meeting|calendar|availability|schedule/i.test(text)) return "meeting";
  if (/newsletter|unsubscribe|digest/i.test(text)) return "newsletter";
  if (/notification|alert|no-?reply/i.test(text)) return "notification";
  if (/project|client|team|review|launch/i.test(text)) return "work";
  return "other";
}

export function analyzeMessage(message: UnifiedMessage, now = new Date()): MessageIntelligence {
  const text = `${message.subject ?? ""}. ${message.body || message.preview}`.trim();
  const priority = scoreMessage(message, now);
  const automationSignals = `${message.subject ?? ""} ${message.preview} ${message.sender.name ?? ""} ${message.sender.address ?? ""}`;
  const isAutomated = /no-?reply|newsletter|unsubscribe|digest|job alert|now casting|sitewide|\bdeal(?:s)?\b|\bsale\b|% off|limited.time|marketing|manage (email )?preferences|view in (your )?browser/i.test(automationSignals);
  const requiresResponse = !isAutomated && (/\?|please (reply|respond|confirm|send|share)|let me know|are you available/i.test(text));
  const actionItems = isAutomated ? [] : text.split(/(?<=[.!?])\s+/).filter((sentence) => /please (?!note)|need|confirm|send|share|reply|respond|schedule/i.test(sentence)).slice(0, 3);
  const category = categoryFor(text);
  const suggestedActions = requiresResponse ? (["DRAFT_REPLY", "FETCH_THREAD"] as const) : isAutomated ? (["ARCHIVE_MESSAGE"] as const) : (["FETCH_THREAD"] as const);
  return {
    summary: message.preview || text.slice(0, 220), priority: priority.priority, priorityScore: priority.score,
    confidence: 0.78, category, requiresResponse, responseRecommended: requiresResponse,
    actionItems, people: message.sender.name ? [message.sender.name] : [], organizations: [], isAutomated,
    suggestedActions: [...suggestedActions], explanation: priority.reasons.join(" · ") || "No urgent signals detected",
    threadState: requiresResponse ? "WAITING_ON_USER" : "INFORMATIONAL",
  };
}

export function enrichMessages(messages: UnifiedMessage[], now = new Date()) {
  return messages.map((message) => ({ ...message, intelligence: message.intelligence ?? analyzeMessage(message, now) }))
    .sort((left, right) => (right.intelligence?.priorityScore ?? 0) - (left.intelligence?.priorityScore ?? 0));
}
