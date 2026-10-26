import { getChatGPTUser } from "@/app/chatgpt-auth";
import { approveFact, approveResume, loadPhase2, prepareMaterial, previewDryRun, revokeFact, savePolicyDraft } from "@/lib/career/phase2-store";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  try { return Response.json(await loadPhase2(user)); } catch { return Response.json({error:"Career materials are temporarily unavailable."},{status:503}); }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  let payload: Record<string,unknown>;
  try { payload = await request.json() as Record<string,unknown>; } catch { return Response.json({error:"Invalid JSON"},{status:400}); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({error:"Invalid request"},{status:400});
  try {
    if (payload.action === "approveFact") await approveFact(user,payload.fact);
    else if (payload.action === "revokeFact") await revokeFact(user,String(payload.id ?? ""));
    else if (payload.action === "approveResume") await approveResume(user,payload.resume);
    else if (payload.action === "savePolicyDraft") await savePolicyDraft(user,payload.policy);
    else if (payload.action === "prepare") return Response.json({result:await prepareMaterial(user,String(payload.jobId ?? "")),state:await loadPhase2(user)});
    else if (payload.action === "preview") return Response.json({result:await previewDryRun(user,String(payload.jobId ?? "")),state:await loadPhase2(user)});
    else return Response.json({error:"Unknown action"},{status:400});
    return Response.json({state:await loadPhase2(user)});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const inputError = /^(Enter|Paste|Approve|Excluded|Job not found|Prepare|Invalid)/.test(message);
    return Response.json({error:inputError ? message : "Career materials are temporarily unavailable."},{status:inputError ? 400 : 503});
  }
}
