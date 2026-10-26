import { getChatGPTUser } from "@/app/chatgpt-auth";
import { loadWorkspace, saveManualSource } from "@/lib/nova/persistence";
import { DEV_WORKSPACE } from "@/lib/nova/dev-workspace";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Sign in with ChatGPT to use your private Atlas workspace." }, { status: 401 });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  try {
    return Response.json(await loadWorkspace(user, url.searchParams.get("q") ?? ""));
  } catch (error) {
    if (user.userId === "local-development-user") return Response.json({ ...DEV_WORKSPACE, demo: true });
    console.error("Atlas workspace load failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Your Atlas library could not be loaded. Try again shortly." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();
  if (user.userId === "local-development-user") return Response.json({ error: "Local demonstration items are read-only." }, { status: 409 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Use a valid JSON request." }, { status: 400 });
  }
  try {
    const result = await saveManualSource(user, {
      title: typeof body.title === "string" ? body.title : "",
      content: typeof body.content === "string" ? body.content : "",
      sourceType: typeof body.sourceType === "string" ? body.sourceType : "note",
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This item could not be saved.";
    return Response.json({ error: message }, { status: message.includes("Add some") ? 400 : 503 });
  }
}
