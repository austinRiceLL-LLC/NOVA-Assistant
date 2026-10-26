import { getChatGPTUser } from "@/app/chatgpt-auth";
import { loadPilot, stopPilot } from "@/lib/career/pilot-store";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in to use Career." }, { status: 401 });
  try { return Response.json(await loadPilot(user)); } catch { return Response.json({ error: "Pilot status is temporarily unavailable." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in to use Career." }, { status: 401 });
  let value: unknown;
  try { value = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const action = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).action : null;
  if (action !== "pause" && action !== "disable") return Response.json({ error: "Only pause and disable are available." }, { status: 400 });
  try { return Response.json(await stopPilot(user, action)); } catch { return Response.json({ error: "Pilot status is temporarily unavailable." }, { status: 503 }); }
}
