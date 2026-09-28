import type { MessagePriority, UnifiedMessage } from "./types.ts";

export interface PriorityFactor { key: string; label: string; weight: number }
export interface PriorityResult { score: number; priority: MessagePriority; reasons: string[]; factors: PriorityFactor[] }

const RECRUITING = /recruit|interview|application|hiring|candidate/i;
const DEADLINE = /deadline|due\s+(today|tomorrow|by)|by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|expires?/i;
const QUESTION = /\?|please (reply|respond|confirm|send|share)|let me know|are you available/i;
const AUTOMATED = /no-?reply|newsletter|unsubscribe|digest|notification/i;
const SECURITY = /security alert|unusual activity|password reset|payment failed|fraud/i;
const DECISION = /approval|approve|decision|review requested|feedback|signature|sign off/i;
const PERSONAL_SENDER = /^(?!.*(?:no-?reply|notifications?|newsletter|marketing|support|updates?))[^@]+@/i;
const PROMOTIONAL = /unsubscribe|% off|sale|deal|promotion|limited.time|shop now|manage preferences/i;

export function scoreMessage(message: Pick<UnifiedMessage, "subject" | "preview" | "body" | "sender" | "unread" | "timestamp">, now = new Date()): PriorityResult {
  const text = `${message.subject ?? ""} ${message.preview} ${message.body ?? ""} ${message.sender.address ?? ""}`;
  let score = 12;
  const factors: PriorityFactor[] = [];
  const add = (key: string, label: string, weight: number) => { score += weight; factors.push({ key, label, weight }); };
  if (SECURITY.test(text)) add("security", "Potential security or financial issue", 58);
  if (RECRUITING.test(text)) add("recruiting", "Recruiting communication", 18);
  if (QUESTION.test(text)) add("request", "Contains a direct question or request", 28);
  if (DEADLINE.test(text)) add("deadline", "Mentions a deadline or time constraint", 24);
  if (DECISION.test(text)) add("decision", "Requests a decision, approval, or review", 16);
  if (message.unread) add("unread", "Unread", 5);
  if (message.sender.address && PERSONAL_SENDER.test(message.sender.address)) add("personal_sender", "Appears to come from a person", 8);
  if (/^re:/i.test(message.subject ?? "")) add("active_thread", "Part of an active conversation", 6);
  const ageHours = Math.max(0, (now.getTime() - new Date(message.timestamp).getTime()) / 3_600_000);
  if (ageHours <= 6) add("fresh", "Received in the last six hours", 10);
  else if (ageHours <= 24) add("recent", "Received today", 6);
  else if (ageHours > 168) add("stale", "More than a week old", -8);
  if (AUTOMATED.test(text)) add("automated", "Appears automated", -30);
  if (PROMOTIONAL.test(text)) add("promotional", "Contains promotional signals", -34);
  score = Math.max(0, Math.min(100, score));
  const reasons = factors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).map(factor => factor.label);
  return { score, priority: score >= 88 ? "critical" : score >= 62 ? "high" : score >= 34 ? "normal" : "low", reasons, factors };
}
