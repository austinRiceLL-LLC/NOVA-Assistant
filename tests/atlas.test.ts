import assert from "node:assert/strict";
import test from "node:test";
import { chooseAccount, restoredStatus } from "../lib/atlas/connections.ts";
import { buildBriefing, connectionStatus, rankInboxSources, syncCandidates, safeSourceUrl, type Source } from "../lib/atlas/workspace.ts";
import { workspaceToChatContext } from "../lib/nova-ai/context-builder.ts";
import { answerFromContext } from "../lib/nova-ai/response-generator.ts";
import { parseSourceTitle } from "../lib/nova-ai/source-title.ts";
import { normalizeComposioResult } from "../lib/nova/normalize-composio.ts";
import { ComposioReadOnlyClient, type ComposioConnectedAccount } from "../lib/nova/providers/composio.ts";
import { inferCapabilities, rankApps, toolkitToCapability } from "../lib/atlas/apps.ts";
const source: Source = { id: "one", externalId: "remote-one", title: "Interview — Amy <amy@example.com>", content: "Are you available Friday? Please reply with two times.", summary: "Please share availability for Friday.", provider: "gmail", sourceType: "email", accountLabel: "Gmail", occurredAt: Date.now(), updatedAt: Date.now(), labels: [], canonicalUrl: null, summaryStrategy: "extractive", modelCallCount: 0 };
const account = (id: string, status: ComposioConnectedAccount["status"]): ComposioConnectedAccount => ({ id, status, user_id: "u1", toolkit: { slug: "gmail" } });
test("restoration preserves the selected mailbox even when another is active", () => {
  assert.equal(chooseAccount([account("work", "EXPIRED"), account("personal", "ACTIVE")], "work")?.id, "work");
  assert.equal(chooseAccount([account("personal", "ACTIVE")], "work"), undefined);
  assert.equal(chooseAccount([account("b", "ACTIVE"), account("a", "ACTIVE")])?.id, "a");
});
test("expired and revoked connections require attention; pending remains pending", () => {
  for (const status of ["EXPIRED", "REVOKED", "INACTIVE"]) assert.equal(restoredStatus(status), "attention");
  assert.equal(restoredStatus("ACTIVE"), "active"); assert.equal(restoredStatus("INITIATED"), "connecting"); assert.equal(restoredStatus("FAILED"), "error");
  assert.equal(connectionStatus("active"), "connected"); assert.equal(connectionStatus("attention"), "attention");
});
test("startup sync includes every eligible app, skips fresh/expired accounts and paused Outlook", () => {
  const c = (provider: string, status = "active", lastSyncAt: number | null = null) => ({ id: provider, provider, status, label: provider, lastSyncAt });
  assert.deepEqual(syncCandidates([c("gmail"), c("linkedin"), c("outlook")], 1000000).map(c => c.provider), ["gmail", "linkedin"]);
  assert.equal(syncCandidates([c("gmail", "attention"), c("linkedin", "active", 999999)], 1000000).length, 0);
});
test("briefing is based on actual messages and has an honest empty state", () => {
  assert.equal(buildBriefing([]).attention.length, 0);
  assert.match(buildBriefing([]).text, /Connect an account/);
  assert.equal(buildBriefing([source]).replies, 1);
  assert.equal(buildBriefing([{ ...source, sourceType: "note" }]).replies, 0);
  const promotion = { ...source, title: "40% off sitewide — Store <news@marketing.example>", content: "Limited-time deal. Manage preferences.", summary: "A promotional sale." };
  assert.equal(buildBriefing([promotion]).attention.length, 0);
});
test("priority ranking separates important messages without hiding the rest", () => {
  const routine = { ...source, id: "routine", title: "Weekly update — Team <updates@example.com>", content: "Here is the weekly digest. Unsubscribe here.", summary: "Weekly update.", occurredAt: Date.now() - 3_600_000 };
  const urgent = { ...source, id: "urgent", title: "Security alert — Bank <alerts@bank.example>", content: "Unusual activity detected. Please confirm today.", summary: "Confirm unusual activity." };
  const result = rankInboxSources([routine, source, urgent]);
  assert.equal(result.ranked[0].source.id, "urgent");
  assert.ok(result.important.some(item => item.source.id === "urgent"));
  assert.ok(result.remaining.some(item => item.source.id === "routine"));
  assert.equal(result.important.length + result.remaining.length, 3);
});
test("sender parsing uses the title suffix, not arbitrary body addresses", () => {
  assert.deepEqual(parseSourceTitle(source.title), { subject: "Interview", sender: "Amy", address: "amy@example.com" });
  assert.equal(parseSourceTitle("No sender").address, undefined);
  assert.equal(parseSourceTitle("Subject — clarification — Amy <amy@example.com>").subject, "Subject — clarification");
});
test("context preserves provider IDs and does not invent unread state", () => {
  const ctx = workspaceToChatContext({ sources: [source], connections: [], selectedMessageId: "one" });
  assert.equal(ctx.messages[0].externalId, "remote-one"); assert.equal(ctx.messages[0].unread, false); assert.equal(ctx.messages[0].sender.address, "amy@example.com");
});
test("contextual and ordinal requests stay on the selected source", () => {
  const ctx = workspaceToChatContext({ sources: [source, { ...source, id: "two", title: "Project — Ben" }], connections: [], selectedMessageId: "two", conversation: [{ role: "assistant", content: "Two sources", referencedMessageIds: ["one", "two"] }] });
  assert.equal(answerFromContext("What should I say to this?", ctx).references[0].id, "two");
  assert.equal(answerFromContext("Show the second one", ctx).references[0].id, "two");
  assert.equal(answerFromContext("Show the first one", ctx).references[0].id, "one");
});
test("answers synthesize source content instead of returning source cards alone", () => {
  const ctx = workspaceToChatContext({ sources: [source], connections: [] });
  const answer = answerFromContext("What is the interview message about?", ctx);
  assert.match(answer.text, /Interview/);
  assert.match(answer.text, /available Friday/i);
  assert.match(answer.text, /requested action/i);
  assert.equal(answer.references[0].id, "one");
});
test("short follow-ups use the prior answer's first referenced source", () => {
  const ctx = workspaceToChatContext({ sources: [source], connections: [], conversation: [{ role: "assistant", content: "I found one.", referencedMessageIds: ["one"] }] });
  const answer = answerFromContext("What did they ask me to do?", ctx);
  assert.match(answer.text, /reply with two times/i);
  assert.equal(answer.references[0].id, "one");
});
test("promotional and alert emails are not mistaken for personal reply requests", () => {
  const promotional = { ...source, title: "Reminder: 40% off sitewide — Store Deals <news@marketing.example>", content: "Please note that terms apply. What will you create? Manage preferences.", summary: "Save 40% during a limited-time sale." };
  const answer = answerFromContext("Summarize my inbox", workspaceToChatContext({ sources: [promotional], connections: [] }));
  assert.doesNotMatch(answer.text, /ask for a response|requested action/i);
  assert.equal(answer.references[0].requiresResponse, false);
});
test("unmatched queries never fall back to unrelated results", () => {
  const ctx = workspaceToChatContext({ sources: [source], connections: [] });
  assert.equal(answerFromContext("Find giraffes", ctx).references.length, 0);
  assert.match(answerFromContext("send it", ctx).text, /haven’t changed anything/);
});
test("source links reject executable protocols", () => {
  assert.equal(safeSourceUrl("javascript:alert(1)"), undefined); assert.equal(safeSourceUrl("data:text/html,hi"), undefined);
  assert.equal(safeSourceUrl("https://mail.google.com/mail/"), "https://mail.google.com/mail/");
});
test("connection verification includes inactive accounts and paginates with identity scope", async () => {
  const urls: string[] = [];
  const client = new ComposioReadOnlyClient({ apiKey: "test", readToolAllowlist: ["GMAIL_FETCH_EMAILS"], fetcher: async input => { urls.push(String(input)); return Response.json(urls.length === 1 ? { items: [account("one", "EXPIRED")], next_cursor: "next" } : { items: [account("two", "ACTIVE")] }); } });
  const result = await client.listConnectedAccounts("u1", true);
  assert.equal(result.items.length, 2); assert.ok(urls.every(url => url.includes("user_ids=u1"))); assert.ok(urls.every(url => !url.includes("statuses="))); assert.match(urls[1], /cursor=next/);
});
test("failed discovery throws instead of reporting all accounts disconnected", async () => {
  const client = new ComposioReadOnlyClient({ apiKey: "test", readToolAllowlist: ["GMAIL_FETCH_EMAILS"], fetcher: async () => new Response("unavailable", { status: 503 }) });
  await assert.rejects(client.listConnectedAccounts("u1", true), /503/);
});
test("Composio toolkit metadata becomes a searchable capability registry", async () => {
  const urls: string[] = [];
  const client = new ComposioReadOnlyClient({ apiKey: "test", readToolAllowlist: ["SAFE_READ"], fetcher: async input => { urls.push(String(input)); return Response.json({ items: [{ slug: "github", name: "GitHub", meta: { description: "Repositories and issues", tools_count: 12, categories: [{ name: "Developer Tools" }] } }] }); } });
  const result = await client.listToolkits("github", 20);
  assert.match(urls[0], /\/api\/v3\/toolkits/); assert.match(urls[0], /search=github/);
  const app = toolkitToCapability(result.items[0], { connectable: true, tools: ["GITHUB_SEARCH_REPOSITORIES", "GITHUB_CREATE_ISSUE"] });
  assert.equal(app.categories[0], "Developer"); assert.equal(app.searchable, true); assert.equal(app.supportsCreate, true); assert.equal(app.connectable, true);
  assert.equal(rankApps([app, { ...app, provider: "notion", displayName: "Notion" }], "github")[0].provider, "github");
});
test("capability inference never claims unsupported write operations", () => {
  assert.deepEqual(inferCapabilities(["DRIVE_SEARCH_FILES", "DRIVE_GET_FILE"]), { searchable: true, readable: true, writable: false, supportsReply: false, supportsSend: false, supportsCreate: false, supportsUpdate: false, supportsDelete: false });
});

test("Gmail MIME body is preferred to a short snippet and attachments stay out", () => {
  const encoded = (s: string) => Buffer.from(s).toString("base64url");
  const items = normalizeComposioResult("gmail", { messages: [{ id: "abc123", subject: "Meeting", snippet: "Short preview", payload: { parts: [{ mimeType: "text/plain", body: { data: encoded("Are you available Friday? Café at 10.") } }, { filename: "secret.txt", mimeType: "text/plain", body: { data: encoded("Attachment content") } }] } }] });
  assert.match(items[0].content, /Café at 10/); assert.doesNotMatch(items[0].content, /Attachment/); assert.match(items[0].canonicalUrl!, /abc123$/);
});
test("HTML message bodies become inert readable text", () => {
  const items = normalizeComposioResult("gmail", { messages: [{ id: "abc", subject: "News", body: "<style>bad css</style><p>Hello &amp; welcome</p><script>bad()</script>" }] });
  assert.equal(items[0].content, "Hello & welcome");
});
