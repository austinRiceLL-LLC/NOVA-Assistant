import { getChatGPTUser } from "@/app/chatgpt-auth";
import { workspaceToChatContext } from "@/lib/nova-ai/context-builder";
import { answerWithAtlas } from "@/lib/nova-ai/assistant";
import { loadWorkspace } from "@/lib/nova/persistence";
import { DEV_WORKSPACE } from "@/lib/nova/dev-workspace";
import type { ChatContext } from "@/lib/nova-ai/types";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to ask Atlas." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.message !== "string" || !body.message.trim()) return Response.json({ error: "Add a message." }, { status: 400 });
  const message = body.message.slice(0, 2000);
  const conversation: ChatContext["conversation"] = Array.isArray(body.conversation) ? body.conversation.slice(-12).filter((item): item is ChatContext["conversation"][number] => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map(item => ({ role: item.role, content: item.content.slice(0, 2000), referencedMessageIds: Array.isArray(item.referencedMessageIds) ? item.referencedMessageIds.filter(id => typeof id === "string").slice(0, 10) : [] })) : [];
  async function answer() {
    let workspace;
    try { workspace = await loadWorkspace(user!); }
    catch (error) { if (user!.userId !== "local-development-user") throw error; workspace = DEV_WORKSPACE; }
    const context = workspaceToChatContext({ page: typeof body!.page === "string" ? body!.page : "/", sources: workspace.sources, connections: workspace.connections, selectedMessageId: typeof body!.selectedMessageId === "string" ? body!.selectedMessageId : undefined, conversation });
    return answerWithAtlas(message, context);
  }
  if (body.stream !== true) {
    try { return Response.json(await answer()); } catch { return Response.json({ error: "Your saved workspace is temporarily unavailable." }, { status: 503 }); }
  }
  const encoder = new TextEncoder();
  // Stream actual processing status and results, with no artificial typing delay.
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) => { if (!request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      try { emit({ type: "status", text: "Reading your saved workspace…" }); const result = await answer(); emit({ type: "text", text: result.text }); emit({ type: "references", references: result.references }); }
      catch { if (!request.signal.aborted) emit({ type: "error", text: "Atlas could not load your sources. Try again shortly." }); }
      finally { try { controller.close(); } catch { /* Client cancelled. */ } }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
