import { getChatGPTUser } from "@/app/chatgpt-auth";
import { generateDraft } from "@/lib/nova-ai/response-generator";
import { draftWithAtlas } from "@/lib/nova-ai/assistant";

export async function POST(request: Request) {
  if (!await getChatGPTUser()) return Response.json({ error: "Sign in to draft replies." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.body !== "string") return Response.json({ error: "A source message is required." }, { status: 400 });
  const input = {
    senderName: typeof body.senderName === "string" ? body.senderName : undefined,
    subject: typeof body.subject === "string" ? body.subject : undefined,
    body: body.body,
    tone: typeof body.tone === "string" ? body.tone : undefined,
    instruction: typeof body.instruction === "string" ? body.instruction : undefined,
  };
  return Response.json(await draftWithAtlas(input).catch(() => null) ?? generateDraft(input));
}
