const paths: Record<string, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
  inbox: <><path d="M4 4h16l2 13v3H2v-3z"/><path d="M2 15h6l2 3h4l2-3h6"/></>,
  chat: <path d="M21 11a9 9 0 0 1-9 9H3l1.5-4A9 9 0 1 1 21 11Z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/></>,
  knowledge: <><path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2z"/></>,
  activity: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
  apps: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  settings: <><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  send: <path d="m12 4 7 7m-7-7-7 7m7-7v16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  plus: <path d="M12 4v16M4 12h16"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 7a8 8 0 0 1 14 0M5 17a8 8 0 0 0 14 0"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  external: <><path d="M14 3h7v7m0-7L10 14"/><path d="M10 3H3v18h18v-7"/></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
  back: <path d="M19 12H5m6-6-6 6 6 6"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.apps}</svg>;
}
