const aliases: Record<string, string> = { google_calendar: "calendar", googlecalendar: "calendar", google_drive: "drive", googledrive: "drive", microsoft_teams: "teams", microsoftteams: "teams", outlookmail: "outlook", microsoft_outlook: "outlook" };
export const providerNames: Record<string, string> = { gmail: "Gmail", outlook: "Outlook", linkedin: "LinkedIn", slack: "Slack", teams: "Microsoft Teams", calendar: "Google Calendar", drive: "Google Drive", notion: "Notion", github: "GitHub", manual: "Saved note" };
export function AppLogo({ provider, size = 22 }: { provider: string; size?: number }) {
  const key = aliases[provider.toLowerCase()] ?? provider.toLowerCase();
  let mark: React.ReactNode;
  switch (key) {
    case "gmail": mark = <><path fill="#4285F4" d="M3 7h5v15H3z"/><path fill="#34A853" d="M24 7h5v15h-5z"/><path fill="#EA4335" d="m3 7 13 10L29 7v-3L16 14 3 4z"/><path fill="#C5221F" d="M3 4v7l5 4V8z"/><path fill="#FBBC04" d="M29 4v7l-5 4V8z"/></>; break;
    case "linkedin": mark = <><rect x="3" y="3" width="26" height="26" rx="3" fill="#0A66C2"/><circle cx="9" cy="10" r="2" fill="white"/><path fill="white" d="M7 14h4v11H7zm7 0h4v1c4-4 8-1 8 3v7h-4v-7c0-3-4-3-4 0v7h-4z"/></>; break;
    case "outlook": mark = <><path fill="#28A8EA" d="M12 4h16v24H12z"/><path fill="#0078D4" d="m11 14 10 7 10-7v14H11z"/><rect x="1" y="8" width="17" height="19" rx="2" fill="#106EBE"/><ellipse cx="9.5" cy="17.5" rx="4" ry="5.5" stroke="white" strokeWidth="2" fill="none"/></>; break;
    case "slack": mark = <><path d="M12 3v10M3 12h10" stroke="#36C5F0" strokeWidth="5" strokeLinecap="round"/><path d="M20 3v10m0-1h9" stroke="#2EB67D" strokeWidth="5" strokeLinecap="round"/><path d="M29 20H19m1 0v9" stroke="#ECB22E" strokeWidth="5" strokeLinecap="round"/><path d="M12 29V19m0 1H3" stroke="#E01E5A" strokeWidth="5" strokeLinecap="round"/></>; break;
    case "calendar": mark = <><rect x="4" y="4" width="24" height="24" rx="3" fill="#4285F4"/><path fill="white" d="M9 10h16v14H9z"/><text x="11" y="21" fill="#4285F4" fontSize="10" fontWeight="700">31</text><path stroke="#34A853" strokeWidth="4" d="M7 27h18"/></>; break;
    case "drive": mark = <><path fill="#0F9D58" d="M11 3h10L10 23H0z"/><path fill="#F4B400" d="M21 3 32 23H22L11 3z"/><path fill="#4285F4" d="M0 23h32l-5 8H5z"/></>; break;
    case "teams": mark = <><circle cx="21" cy="7" r="5" fill="#7B83EB"/><rect x="12" y="13" width="18" height="16" rx="6" fill="#7B83EB"/><rect x="2" y="8" width="18" height="19" rx="2" fill="#5059C9"/><path d="M6 13h10m-5 0v10" stroke="white" strokeWidth="2.5"/></>; break;
    case "notion": mark = <><rect x="3" y="3" width="26" height="26" rx="3" fill="white" stroke="#333"/><path d="M9 24V9h3l9 15V9" fill="none" stroke="#111" strokeWidth="3"/></>; break;
    case "github": mark = <><circle cx="16" cy="16" r="14" fill="currentColor"/><path fill="var(--atlas-surface, #141820)" d="M9 12 8 7l6 3h4l6-3-1 5c5 8-1 12-5 12v6h-4v-6C7 23 5 18 9 12Z"/></>; break;
    default: mark = <><rect x="5" y="5" width="22" height="22" rx="6" stroke="currentColor" fill="none" strokeWidth="1.8"/><path d="M10 16h12m-6-6v12" stroke="currentColor" strokeWidth="1.8"/></>;
  }
  return <svg className="app-logo" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={providerNames[key] ?? provider}>{mark}</svg>;
}
