import { getChatGPTUser } from "@/app/chatgpt-auth";
import { approveApplicationProfile, loadApplicationProfile, saveApplicationProfile } from "@/lib/career/profile-storage";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  try { return Response.json(await loadApplicationProfile(user),{headers:privateHeaders}); }
  catch { return Response.json({error:"Application details are temporarily unavailable."},{status:503}); }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  try {
    const payload = await request.json() as { action?: string; data?: unknown; version?: number };
    const state = payload.action === "save" ? await saveApplicationProfile(user,payload.data)
      : payload.action === "approve" ? await approveApplicationProfile(user,payload.version ?? 0)
      : null;
    if (!state) return Response.json({error:"Unknown action"},{status:400});
    return Response.json(state,{headers:privateHeaders});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const invalid = /^(Invalid|Enter|Save)/.test(message);
    return Response.json({error:invalid ? message : "Application details are temporarily unavailable."},{status:invalid ? 400 : 503});
  }
}
