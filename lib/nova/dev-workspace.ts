export const DEV_WORKSPACE = {
  user: { displayName: "Austin", email: "local@nova.dev" },
  sources: [
    { id: "demo-recruiter", title: "Interview availability — Priya Shah", content: "Are you available Thursday afternoon for the final product interview? Please send two times that work for you.", summary: "A recruiter is requesting two Thursday time options for a final interview.", sourceType: "email", provider: "gmail", accountLabel: "Demo Gmail", canonicalUrl: null, labels: ["recruiting", "needs-reply"], occurredAt: Date.now() - 28 * 60_000, updatedAt: Date.now() - 28 * 60_000, summaryStrategy: "demo", modelCallCount: 0 },
    { id: "demo-project", title: "Launch checklist — Marcus Lee", content: "Please review the final analytics events by Friday. The rest of the launch checklist is complete.", summary: "The launch is on track; your analytics-event approval is needed by Friday.", sourceType: "email", provider: "outlook", accountLabel: "Demo Outlook", canonicalUrl: null, labels: ["work", "deadline"], occurredAt: Date.now() - 85 * 60_000, updatedAt: Date.now() - 85 * 60_000, summaryStrategy: "demo", modelCallCount: 0 },
  ],
  connections: [
    { id: "demo-gmail", provider: "gmail", label: "Demo Gmail", status: "active", externalAccountId: "demo", lastSyncAt: Date.now() },
    { id: "demo-outlook", provider: "outlook", label: "Demo Outlook", status: "active", externalAccountId: "demo", lastSyncAt: Date.now() },
  ],
  briefing: "Two messages need attention: an interview scheduling request and a launch approval due Friday.",
  budget: { summaryMode: "deterministic", dailyModelCallLimit: 0, batchSize: 25, onlyProcessChangedContent: true, modelCallsInView: 0, unchangedItemsSkipped: 2 },
};
