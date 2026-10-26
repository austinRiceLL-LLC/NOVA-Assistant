export function AtlasMark({ state = "idle", size = 32 }: { state?: "idle" | "thinking" | "working" | "success"; size?: number }) {
  return <svg className={`atlas-mark atlas-mark--${state}`} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="1.3" opacity=".4" />
    <ellipse cx="20" cy="20" rx="6.5" ry="15" transform="rotate(35 20 20)" stroke="currentColor" strokeWidth="1.3" />
    <ellipse cx="20" cy="20" rx="15" ry="6.5" transform="rotate(35 20 20)" stroke="currentColor" strokeWidth="1.3" />
    <path d="M20 14l1.6 4.4L26 20l-4.4 1.6L20 26l-1.6-4.4L14 20l4.4-1.6z" fill="currentColor" />
    <g className="atlas-orbit"><circle cx="31" cy="10" r="2.2" fill="currentColor" /></g>
  </svg>;
}
export function AtlasStatus({ state = "idle", children }: { state?: "idle" | "thinking" | "working" | "success"; children: React.ReactNode }) {
  return <span className="atlas-status" role="status"><AtlasMark state={state} size={24} /><span>{children}</span></span>;
}
