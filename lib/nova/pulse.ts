export type PulseSource = {
  id: string;
  title: string;
  summary: string;
  sourceType: string;
  provider: string;
  updatedAt: number;
};

export type PulseConnection = {
  id?: string;
  provider: string;
  status: string;
};

export type PulseWorkspace = {
  sources: PulseSource[];
  connections: PulseConnection[];
  briefing: string;
};

export type PulseReportItem = {
  id: string;
  provider: string;
  title: string;
  body: string;
  updatedAt: number | null;
  tone: "update" | "attention";
};

function providerName(provider: string) {
  if (provider === "gmail") return "Gmail";
  if (provider === "outlook") return "Outlook";
  if (provider === "linkedin") return "LinkedIn";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function buildPulseReport(workspace: PulseWorkspace) {
  const attention = workspace.connections
    .filter((connection) => connection.status !== "active")
    .map<PulseReportItem>((connection) => ({
      id: `connection:${connection.provider}`,
      provider: "Connection",
      title: `${providerName(connection.provider)} needs attention`,
      body: connection.status === "connecting"
        ? "Finish sign-in before Atlas can report on this account."
        : "Reconnect this account before the next check.",
      updatedAt: null,
      tone: "attention",
    }));

  const updates = workspace.sources.slice(0, 4).map<PulseReportItem>((source) => ({
    id: source.id,
    provider: providerName(source.provider),
    title: source.title,
    body: source.summary,
    updatedAt: source.updatedAt,
    tone: "update",
  }));

  const items = [...attention, ...updates].slice(0, 5);
  const reportCount = items.length;
  return {
    headline: reportCount
      ? `${reportCount} short report${reportCount === 1 ? "" : "s"} ready.`
      : "No reports yet. Connect an account or save a note to begin.",
    badgeCount: reportCount,
    items,
  };
}

export function answerPulse(question: string, workspace: PulseWorkspace) {
  const normalized = question.trim().toLowerCase();
  const sourceFor = (...providers: string[]) => workspace.sources.find((source) => providers.includes(source.provider));
  const connectionFor = (provider: string) => workspace.connections.find((connection) => connection.provider === provider);

  if (/outlook|work mail/.test(normalized)) {
    const latest = sourceFor("outlook");
    const connection = connectionFor("outlook");
    if (connection?.status !== "active") return "Outlook still needs sign-in before I can report on that mailbox.";
    return latest ? `Latest Outlook item: ${latest.title}. ${latest.summary}` : "Outlook is connected, but no saved messages are available yet. Select Check email.";
  }

  if (/gmail|email|message|inbox/.test(normalized)) {
    const latest = sourceFor("gmail", "outlook");
    return latest ? `Latest email: ${latest.title}. ${latest.summary}` : "No email is saved yet. Connect Gmail or Outlook, then select Check email.";
  }

  if (/linkedin|career|profile/.test(normalized)) {
    const latest = sourceFor("linkedin");
    return latest ? `Latest LinkedIn item: ${latest.title}. ${latest.summary}` : "No LinkedIn information is saved yet.";
  }

  if (/cost|model|call/.test(normalized)) {
    return "Routine Atlas Pulse reports use deterministic summaries and 0 model calls.";
  }

  return workspace.briefing;
}
