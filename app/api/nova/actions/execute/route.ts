import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getComposioGmailSendConfig, getComposioGmailTrashConfig, getComposioProviderConfig } from "@/lib/nova/composio-config";
import { deleteSource, getConnection, getSourceForAction } from "@/lib/nova/persistence";
import { ComposioReadOnlyClient } from "@/lib/nova/providers/composio";
import { authorizeProposal } from "@/lib/nova-ai/tool-policy";
import type { NovaActionProposal } from "@/lib/nova-ai/types";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to execute actions." }, { status: 401 });
  const body = await request.json().catch(() => null) as { proposal?: NovaActionProposal; confirmedProposalId?: string } | null;
  if (!body?.proposal) return Response.json({ error: "A visible action proposal is required." }, { status: 400 });
  const decision = authorizeProposal(body.proposal, { userId: user.userId, accountUserId: user.userId, confirmedProposalId: body.confirmedProposalId });
  if (!decision.allowed) return Response.json({ error: decision.reason, confirmationRequired: true }, { status: 409 });
  const mode = (env as unknown as Record<string, string | undefined>).NOVA_TOOL_EXECUTION_MODE ?? "mock";
  if (mode !== "live") return Response.json({ status: "simulated", receiptId: crypto.randomUUID(), message: "Simulated only; no external provider was contacted." });
  if (body.proposal.intent !== "SEND_REPLY" && body.proposal.intent !== "ARCHIVE_MESSAGE") return Response.json({ error: "This live action is not installed. Nothing was changed." }, { status: 501 });

  const connection = await getConnection(user.userId, "gmail");
  if (!connection?.external_account_id || connection.id !== body.proposal.accountId) {
    return Response.json({ error: "The selected Gmail account is not connected to this Atlas user." }, { status: 403 });
  }
  const args = body.proposal.arguments;
  if (body.proposal.intent === "ARCHIVE_MESSAGE") {
    const source = await getSourceForAction(user.userId, body.proposal.targetId);
    if (!source || source.provider !== "gmail" || source.connector_account_id !== connection.id || source.external_id !== args.message_id) {
      return Response.json({ error: "The selected Gmail message does not belong to this Atlas user." }, { status: 403 });
    }
    try {
      const config = getComposioGmailTrashConfig();
      let composioUserId = user.userId;
      if (user.userId === "local-development-user") {
        const discoveryConfig = getComposioProviderConfig("gmail");
        const discoveryClient = new ComposioReadOnlyClient({ apiKey: discoveryConfig.apiKey, readToolAllowlist: [discoveryConfig.toolSlug] });
        const accounts = await discoveryClient.listAllConnectedAccounts();
        const account = accounts.items.find((item) => item.id === connection.external_account_id && item.status === "ACTIVE" && item.toolkit.slug.toLowerCase() === "gmail");
        if (!account) throw new Error("Connected Gmail account unavailable.");
        composioUserId = account.user_id;
      }
      const client = new ComposioReadOnlyClient({ apiKey: config.apiKey, readToolAllowlist: [getComposioProviderConfig("gmail").toolSlug], writeToolAllowlist: [config.toolSlug] });
      const result = await client.executeActionTool({ toolSlug: config.toolSlug, version: config.toolVersion, connectedAccountId: connection.external_account_id, userId: composioUserId, confirmed: true, arguments: { message_id: source.external_id, user_id: "me" } });
      if (!result.successful) throw new Error(result.error || "Gmail rejected the trash request.");
      await deleteSource(user.userId, source.id);
      return Response.json({ status: "trashed", receiptId: result.log_id ?? crypto.randomUUID(), message: "Moved to Gmail Trash." });
    } catch (error) {
      console.error("Atlas Gmail trash failed", error instanceof Error ? error.message : "unknown error");
      return Response.json({ error: "Gmail could not move the message to Trash. It remains in Atlas." }, { status: 502 });
    }
  }
  const recipient = typeof args.recipient_email === "string" ? args.recipient_email.trim() : "";
  const subject = typeof args.subject === "string" ? args.subject.trim() : "";
  const message = typeof args.body === "string" ? args.body.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || !subject || !message) {
    return Response.json({ error: "The confirmed email is incomplete. Nothing was sent." }, { status: 400 });
  }

  try {
    const config = getComposioGmailSendConfig();
    let composioUserId = user.userId;
    if (user.userId === "local-development-user") {
      const discoveryConfig = getComposioProviderConfig("gmail");
      const discoveryClient = new ComposioReadOnlyClient({ apiKey: discoveryConfig.apiKey, readToolAllowlist: [discoveryConfig.toolSlug] });
      const accounts = await discoveryClient.listAllConnectedAccounts();
      const account = accounts.items.find((item) => item.id === connection.external_account_id && item.status === "ACTIVE" && item.toolkit.slug.toLowerCase() === "gmail");
      if (!account) throw new Error("Connected Gmail account unavailable.");
      composioUserId = account.user_id;
    }
    const client = new ComposioReadOnlyClient({ apiKey: config.apiKey, readToolAllowlist: [getComposioProviderConfig("gmail").toolSlug], writeToolAllowlist: [config.toolSlug] });
    const result = await client.executeActionTool({
      toolSlug: config.toolSlug,
      version: config.toolVersion,
      connectedAccountId: connection.external_account_id,
      userId: composioUserId,
      confirmed: true,
      arguments: { recipient_email: recipient, subject, body: message, is_html: false, user_id: "me" },
    });
    if (!result.successful) throw new Error(result.error || "Gmail rejected the message.");
    return Response.json({ status: "sent", receiptId: result.log_id ?? crypto.randomUUID(), message: "Sent through Gmail." });
  } catch (error) {
    console.error("Atlas Gmail send failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Atlas could not confirm whether Gmail sent the message. Check Sent before retrying." }, { status: 502 });
  }
}
