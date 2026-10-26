import type { ComposioConnectedAccount } from "../nova/providers/composio.ts";
export function restoredStatus(status: string) {
  if (status === "ACTIVE") return "active";
  if (status === "INITIALIZING" || status === "INITIATED") return "connecting";
  if (status === "FAILED") return "error";
  return "attention";
}
// Preserve the chosen upstream account. Never replace it with a different mailbox
// just because the other one happens to be active or appears last in a response.
export function chooseAccount(accounts: ComposioConnectedAccount[], existingId?: string | null) {
  if (existingId) return accounts.find(a => a.id === existingId);
  return accounts.filter(a => a.status === "ACTIVE").sort((a, b) => a.id.localeCompare(b.id))[0];
}
