import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getComposioProviderConfig } from "@/lib/nova/composio-config";
import { getConnection, saveDiscoveredConnection, updateConnectionStatus, type SupportedCloudProvider } from "@/lib/nova/persistence";
import { ComposioReadOnlyClient } from "@/lib/nova/providers/composio";
import { chooseAccount, restoredStatus } from "@/lib/atlas/connections";

const TOOLKIT_PROVIDER: Record<string, SupportedCloudProvider | undefined> = {
  gmail: "gmail", outlook: "outlook", outlookmail: "outlook", microsoft_outlook: "outlook", linkedin: "linkedin",
};

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in before discovering connected accounts." }, { status: 401 });
  const config = getComposioProviderConfig("gmail");
  if (!config.apiKey) return Response.json({ error: "Composio is not configured on this deployment." }, { status: 503 });
  try {
    const client = new ComposioReadOnlyClient({ apiKey: config.apiKey, readToolAllowlist: [config.toolSlug] });
    const result = user.userId === "local-development-user"
      ? await client.listAllConnectedAccounts(true)
      : await client.listConnectedAccounts(user.userId, true);
    const discovered: Array<{ provider: string; accountId: string }> = [];
    for (const provider of ["gmail", "linkedin", "outlook"] as const) {
      const existing = await getConnection(user.userId, provider);
      // Outlook remains opt-in while the known external issue is unresolved.
      if (provider === "outlook" && !existing) continue;
      const accounts = result.items.filter(a => TOOLKIT_PROVIDER[a.toolkit.slug.toLowerCase()] === provider && (user.userId === "local-development-user" || a.user_id === user.userId));
      const account = chooseAccount(accounts, existing?.external_account_id);
      if (account?.status === "ACTIVE") {
        await saveDiscoveredConnection(user, provider, account.id);
        discovered.push({ provider, accountId: account.id });
      } else if (existing) {
        await updateConnectionStatus(user.userId, provider, account ? restoredStatus(account.status) : "attention");
      }
    }
    const knownAccountIds = new Set(discovered.map(item => item.accountId));
    for (const account of result.items) {
      const provider = account.toolkit.slug.toLowerCase();
      if (TOOLKIT_PROVIDER[provider] || account.status !== "ACTIVE" || knownAccountIds.has(account.id)) continue;
      if (user.userId !== "local-development-user" && account.user_id !== user.userId) continue;
      await saveDiscoveredConnection(user, provider, account.id, provider.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()));
      discovered.push({ provider, accountId: account.id });
    }
    return Response.json({ discovered });
  } catch (error) {
    console.error("NOVA Composio discovery failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Connected Composio accounts could not be discovered." }, { status: 502 });
  }
}
