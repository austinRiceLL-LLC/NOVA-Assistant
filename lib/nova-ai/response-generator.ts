import { enrichMessages } from "./message-intelligence.ts";
import type { ChatContext } from "./types.ts";

const STOP_WORDS = new Set(["about", "could", "email", "emails", "find", "from", "have", "message", "messages", "please", "show", "tell", "that", "their", "there", "these", "they", "this", "what", "when", "where", "which", "with", "would", "your"]);

function compact(value: string | undefined, limit = 280) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function sentenceAnswer(message: ReturnType<typeof enrichMessages>[number]) {
  const details = compact(message.body || message.preview, 360);
  const summary = compact(message.intelligence?.summary || message.preview, 240);
  const subject = compact(message.subject, 100);
  const sender = compact(message.sender.name || message.sender.address, 80);
  const lead = subject ? `“${subject}”${sender ? ` from ${sender}` : ""}` : sender ? `The item from ${sender}` : "This saved item";
  const explanation = details && details.toLowerCase() !== summary.toLowerCase() ? `${summary}\n\nThe source says: ${details}` : summary || details;
  const request = message.intelligence?.actionItems[0];
  const next = request ? `\n\nThe clearest requested action is: ${compact(request, 220)}` : message.intelligence?.requiresResponse ? "\n\nIt appears to ask for a response, but I couldn’t isolate a single requested action." : "\n\nI don’t see a clear request for you to reply.";
  return `${lead} is about ${explanation || "an item whose content is not available in the saved record."}${next}`;
}

export function answerFromContext(question: string, context: ChatContext) {
  const messages = enrichMessages(context.messages);
  const query = question.toLowerCase();
  if (/^(send (it|that)|delete|trash|archive)\b/.test(query)) return { text: "Open the message or draft to review the exact action and confirm it. I haven’t changed anything.", references: [] };
  if (!messages.length) return { text: "I don’t have any saved sources to review yet. Connect an app or save a note, then ask again.", references: [] };
  const previousIds = [...context.conversation].reverse().find(t => t.role === "assistant" && t.referencedMessageIds?.length)?.referencedMessageIds ?? [];
  const ordinal = /\b(first|second|third)\b/.exec(query)?.[1];
  const contextual = /\b(this|that|these|those|her|his|it|they|them|say|said|ask|asked|shorter|respond|reply|more|why|when|who)\b/.test(query) || Boolean(ordinal);
  const referencedId = ordinal ? previousIds[["first", "second", "third"].indexOf(ordinal)] : context.selectedMessageId ?? (contextual ? previousIds[0] : undefined);
  const chosen = referencedId && contextual ? messages.find(m => m.id === referencedId) : undefined;
  const attention = /need.*(reply|replies|attention)|important|priority|waiting on me|handle first/.test(query);
  const summary = /summar|brief|what.*changed|plan.*day/.test(query);
  const knowledge = /knowledge|notes|documents/.test(query);
  const scheduling = /schedul|meeting|calendar|availability/.test(query);
  const results = chosen ? [chosen] : messages.filter(m => {
    const text = `${m.sender.name ?? ""} ${m.subject ?? ""} ${m.preview} ${m.body ?? ""}`.toLowerCase();
    if (/recruit|interview/.test(query)) return /recruit|interview|application|hiring/.test(text);
    if (attention) return Boolean(m.intelligence?.requiresResponse || ["critical", "high"].includes(m.intelligence?.priority ?? ""));
    if (knowledge) return !["email", "message"].includes(String(m.metadata?.sourceType ?? "email"));
    if (scheduling) return /meeting|availability|schedule|calendar/.test(text);
    if (summary) return !/inbox|email|message/.test(query) || ["email", "message"].includes(String(m.metadata?.sourceType ?? "email"));
    const terms = query.split(/\W+/).filter(term => term.length > 2 && !STOP_WORDS.has(term));
    return terms.length > 0 && terms.some(term => text.includes(term));
  }).slice(0, 5);
  if (!results.length) return { text: attention ? "I don’t see strong reply or urgency signals in your saved messages. That isn’t a guarantee—open the inbox to review anything you’re unsure about." : "I couldn’t find a matching source in your saved workspace. Try a sender’s name or a phrase from the message.", references: [] };
  const replyCount = results.filter(m => m.intelligence?.requiresResponse).length;
  const text = chosen ? sentenceAnswer(chosen)
    : results.length === 1 ? sentenceAnswer(results[0])
    : `${attention ? `I found ${results.length} items with reply or priority signals.` : `I found ${results.length} saved items that match.`}${replyCount ? ` ${replyCount === 1 ? "One appears to need a reply." : `${replyCount} appear to need replies.`}` : ""}\n\n${results.map((item, index) => `${index + 1}. ${compact(item.subject || item.sender.name || "Saved item", 100)} — ${compact(item.intelligence?.summary || item.preview, 180)}`).join("\n")}${scheduling ? "\n\nCalendar availability isn’t connected, so I can identify scheduling requests but can’t verify a free time." : ""}`;
  return { text, references: results.map(m => ({ id: m.id, title: m.subject || m.sender.name || "Source", source: m.source, summary: m.intelligence?.summary ?? m.preview, priority: m.intelligence?.priority ?? "normal", why: m.intelligence?.explanation ?? "Matches your request", requiresResponse: m.intelligence?.requiresResponse ?? false, canonicalUrl: m.canonicalUrl })) };
}

export function generateDraft(input: { senderName?: string; subject?: string; body: string; tone?: string; instruction?: string }) {
  const name = input.senderName?.split(" ")[0] || "there";
  const tone = input.tone ?? "professional";
  const core = input.instruction?.trim() || "Thank you for reaching out. I appreciate the update and will follow up shortly.";
  return { recipient: input.senderName || "Recipient", subject: input.subject?.startsWith("Re:") ? input.subject : `Re: ${input.subject || "Your message"}`, tone, body: `Hi ${name},\n\n${core}\n\nBest,` };
}
