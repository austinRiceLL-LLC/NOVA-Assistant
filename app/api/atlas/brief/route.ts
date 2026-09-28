import { getChatGPTUser } from "@/app/chatgpt-auth";
import { loadWorkspace } from "@/lib/nova/persistence";
import { buildBriefing } from "@/lib/atlas/workspace";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to open Atlas Brief." }, { status: 401 });
  try {
    const workspace = await loadWorkspace(user); const briefing = buildBriefing(workspace.sources);
    const ranked = (briefing.attention.length ? briefing.attention : briefing.ranked).slice(0, 10);
    return Response.json({ generatedAt: Date.now(), summary: briefing.text, attentionCount: briefing.attention.length, replyCount: briefing.replies,
      topItems: ranked.map(({ source, intelligence }) => ({ id: source.id, externalId: source.externalId, title: source.title, summary: source.summary, provider: source.provider, sourceType: source.sourceType, accountLabel: source.accountLabel, canonicalUrl: source.canonicalUrl, occurredAt: source.occurredAt, priority: intelligence.priority, requiresResponse: intelligence.requiresResponse, explanation: intelligence.explanation })),
      appState: workspace.connections.map(({ id, provider, label, status, lastSyncAt }) => ({ id, provider, label, status, lastSyncAt })) });
  } catch { return Response.json({ error: "Atlas Brief is temporarily unavailable." }, { status: 503 }); }
}
