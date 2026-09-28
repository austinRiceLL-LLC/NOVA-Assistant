import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getComposioApiKey, getToolkitAuthConfig } from "@/lib/nova/composio-config";
import { ComposioReadOnlyClient } from "@/lib/nova/providers/composio";
import { loadWorkspace } from "@/lib/nova/persistence";
import { rankApps, toolkitToCapability } from "@/lib/atlas/apps";

export const dynamic = "force-dynamic";
const CACHE_TTL = 15 * 60_000;
let cache: { at: number; items: Awaited<ReturnType<ComposioReadOnlyClient["listToolkits"]>>["items"] } | null = null;

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to browse applications." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 120) ?? "";
  const apiKey = getComposioApiKey();
  if (!apiKey) return Response.json({ items: [], categories: [], registry: "unavailable", error: "Composio application discovery is not configured." });
  try {
    if (!cache || Date.now() - cache.at > CACHE_TTL || query) {
      const client = new ComposioReadOnlyClient({ apiKey, readToolAllowlist: ["ATLAS_DISCOVERY_PLACEHOLDER"] });
      const result = await client.listToolkits(query, query ? 40 : 60);
      if (!query) cache = { at: Date.now(), items: result.items };
      const workspace = await loadWorkspace(user);
      const connected = workspace.connections.map(item => item.provider.toLowerCase());
      const items = rankApps(result.items.map(toolkit => toolkitToCapability(toolkit, { connected: connected.includes(toolkit.slug.toLowerCase()), connectable: Boolean(getToolkitAuthConfig(toolkit.slug)) })), query, connected);
      return Response.json({ items, categories: [...new Set(items.flatMap(item => item.categories))], registry: "composio", cached: false });
    }
    const workspace = await loadWorkspace(user);
    const connected = workspace.connections.map(item => item.provider.toLowerCase());
    const items = rankApps(cache.items.map(toolkit => toolkitToCapability(toolkit, { connected: connected.includes(toolkit.slug.toLowerCase()), connectable: Boolean(getToolkitAuthConfig(toolkit.slug)) })), query, connected);
    return Response.json({ items, categories: [...new Set(items.flatMap(item => item.categories))], registry: "composio", cached: true });
  } catch (error) {
    console.error("Atlas app discovery failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Atlas could not load the Composio application registry." }, { status: 502 });
  }
}
