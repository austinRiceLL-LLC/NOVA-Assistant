import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getComposioApiKey, getToolkitAuthConfig } from "@/lib/nova/composio-config";
import { savePendingConnection } from "@/lib/nova/persistence";
import { ComposioReadOnlyClient } from "@/lib/nova/providers/composio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT before connecting an account." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : provider;
  if (!/^[a-z0-9_]{1,80}$/.test(provider)) return Response.json({ error: "Choose an available application." }, { status: 400 });
  const apiKey = getComposioApiKey();
  const authConfigId = getToolkitAuthConfig(provider);
  if (!apiKey || !authConfigId) {
    return Response.json({
      code: "setup_required",
      error: `${displayName || provider} is available through Composio, but its secure authentication configuration has not been added to Atlas yet.`,
    }, { status: 503 });
  }

  try {
    const client = new ComposioReadOnlyClient({ apiKey, readToolAllowlist: ["ATLAS_DISCOVERY_PLACEHOLDER"] });
    const callbackUrl = new URL(`/workspace?connected=${encodeURIComponent(provider)}`, request.url).toString();
    const link = await client.createAuthLink({
      authConfigId,
      userId: user.userId,
      alias: `${provider}-${user.userId}`.slice(0, 120),
      callbackUrl,
    });
    await savePendingConnection(user, provider, link.connected_account_id, displayName);
    return Response.json({ redirectUrl: link.redirect_url, expiresAt: link.expires_at });
  } catch (error) {
    console.error("Atlas connection failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "The secure connection could not be started. Try again shortly." }, { status: 502 });
  }
}
