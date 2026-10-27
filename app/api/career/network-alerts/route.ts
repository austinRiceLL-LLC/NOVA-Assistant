import { getChatGPTUser } from "@/app/chatgpt-auth";
import { networkAlertLinks } from "@/lib/career/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to use Career." }, { status: 401 });
  try { return Response.json({ links: await networkAlertLinks(user) }); }
  catch { return Response.json({ error: "Saved alerts are temporarily unavailable." }, { status: 503 }); }
}
