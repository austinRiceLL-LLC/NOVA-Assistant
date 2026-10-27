import { getChatGPTUser } from "@/app/chatgpt-auth";
import { archiveResumeFile, listResumeFiles, selectResumeFile, uploadResumeFile } from "@/lib/career/profile-storage";
import { maxResumeBytes } from "@/lib/career/application-profile";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  try { return Response.json({files:await listResumeFiles(user)},{headers:privateHeaders}); }
  catch { return Response.json({error:"Resume library is temporarily unavailable."},{status:503}); }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxResumeBytes + 50_000) return Response.json({error:"Resume file must be 750 KB or smaller"},{status:413});
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return Response.json({error:"Choose a resume file"},{status:400});
    if (file.size > maxResumeBytes) return Response.json({error:"Resume file must be 750 KB or smaller"},{status:413});
    return Response.json({files:await uploadResumeFile(user,file)},{headers:privateHeaders});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const invalid = /^(Invalid|Resume|Upload|Archive)/.test(message);
    return Response.json({error:invalid ? message : "Resume upload is temporarily unavailable."},{status:invalid ? 400 : 503});
  }
}
export async function DELETE(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({error:"Invalid resume file"},{status:400});
    return Response.json({files:await archiveResumeFile(user,id)},{headers:privateHeaders});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json({error:message === "Resume file not found" ? message : "Resume archive is temporarily unavailable."},{status:message === "Resume file not found" ? 404 : 503});
  }
}
export async function PATCH(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({error:"Invalid resume file"},{status:400});
    return Response.json({files:await selectResumeFile(user,id)},{headers:privateHeaders});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json({error:message === "Resume file not found" ? message : "Resume selection is temporarily unavailable."},{status:message === "Resume file not found" ? 404 : 503});
  }
}
