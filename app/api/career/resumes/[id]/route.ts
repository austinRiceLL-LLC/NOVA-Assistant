import { getChatGPTUser } from "@/app/chatgpt-auth";
import { downloadResumeFile } from "@/lib/career/profile-storage";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return Response.json({error:"Sign in to use Career."},{status:401});
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({error:"Invalid resume file"},{status:400});
  try {
    const row = await downloadResumeFile(user,id);
    if (!row) return Response.json({error:"Resume file not found"},{status:404});
    const bytes = row.content instanceof ArrayBuffer ? new Uint8Array(row.content) : Uint8Array.from(row.content);
    return new Response(bytes,{headers:{"Content-Type":row.media_type,"Content-Disposition":`attachment; filename="resume"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch { return Response.json({error:"Resume download is temporarily unavailable."},{status:503}); }
}
