import { getChatGPTUser } from "@/app/chatgpt-auth";
import { addSource, loadCareer, removeSource, runDiscovery, savePreferences } from "@/lib/career/store";

export const dynamic = "force-dynamic";
const unauthenticated = () => Response.json({ error: "Sign in to use Career." }, { status: 401 });
const failure = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const inputError = /^(Invalid|Enter|Add a public|Wait one minute)/.test(message);
  return Response.json({ error: inputError ? message : "Career is temporarily unavailable." }, { status: inputError ? 400 : 503 });
};
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return unauthenticated();
  try { return Response.json(await loadCareer(user)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return unauthenticated();
  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    if (payload.action === "preferences") await savePreferences(user, payload.preferences);
    else if (payload.action === "addSource") await addSource(user, payload.source);
    else if (payload.action === "removeSource") await removeSource(user, String(payload.id ?? ""));
    else if (payload.action === "discover") return Response.json({ run: await runDiscovery(user), state: await loadCareer(user) });
    else return Response.json({ error: "Unknown action" }, { status: 400 });
    return Response.json(await loadCareer(user));
  } catch (error) { return failure(error); }
}
