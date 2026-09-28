"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtlasMark, AtlasStatus } from "../components/atlas/atlas-mark";
import { Icon } from "../components/atlas/icon";
import { AppLogo } from "../components/atlas/app-logo";
import { ConnectedApps, ConnectedCluster } from "../components/atlas/connected-apps";
import { AtlasComposer } from "../components/atlas/composer";
import { Chat } from "../components/atlas/chat";
import { Inbox, SourceRow } from "../components/atlas/inbox";
import { Dialog } from "../components/atlas/dialog";
import { DraftDialog, type DraftData } from "../components/atlas/draft-dialog";
import { AtlasCompanion, type AtlasSurface } from "../components/atlas/atlas-companion";
import { api, useWorkspace } from "../components/atlas/use-workspace";
import { buildBriefing, relativeTime, type ChatTurn, type Provider, type Source, type WorkspaceView, type Reference } from "@/lib/atlas/workspace";
import { parseSourceTitle } from "@/lib/nova-ai/source-title";
import type { NovaActionProposal } from "@/lib/nova-ai/types";

const NAV: Array<{ id: WorkspaceView; label: string }> = [{ id: "home", label: "Home" }, { id: "inbox", label: "Inbox" }, { id: "chat", label: "Ask Atlas" }, { id: "calendar", label: "Calendar" }, { id: "knowledge", label: "Knowledge" }, { id: "activity", label: "Activity" }];

export default function WorkspaceClient({ user }: { user: { displayName: string; email: string } | null }) {
  const ws = useWorkspace(user?.email);
  const [view, setView] = useState<WorkspaceView>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [theme, setTheme] = useState("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [command, setCommand] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [surface, setSurface] = useState<AtlasSurface>("workspace");
  const [sessionReady, setSessionReady] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState("");
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [pending, setPending] = useState<{ proposal?: NovaActionProposal; source?: Source; kind: "trash" | "remove" } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [capture, setCapture] = useState(false);
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureBody, setCaptureBody] = useState("");
  const [captureType, setCaptureType] = useState("note");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeSource, setKnowledgeSource] = useState<Source | null>(null);
  const [greeting, setGreeting] = useState("Welcome back");
  const abortChat = useRef<AbortController | null>(null);
  const chatInFlight = useRef(false);
  const sources = ws.data?.sources ?? [];
  const briefing = useMemo(() => buildBriefing(ws.data?.sources ?? []), [ws.data?.sources]);
  const selected = sources.find(s => s.id === selectedId);
  const gmail = ws.connections.find(c => c.provider === "gmail" && c.status === "active");
  const navigate = useCallback((next: WorkspaceView) => { setView(next); setMobileNav(false); setPalette(false); window.history.replaceState(null, "", `#${next}`); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash = window.location.hash.slice(1) as WorkspaceView;
      if ([...NAV.map(n => n.id), "apps", "settings"].includes(hash)) setView(hash);
      try { const saved = localStorage.getItem("atlas:theme"); if (saved === "light" || saved === "dark") setTheme(saved); } catch { /* Optional preference. */ }
      try {
        const savedSurface = localStorage.getItem("atlas:surface"); if (savedSurface === "edge" || savedSurface === "brief" || savedSurface === "workspace") setSurface(savedSurface);
        const savedSession = JSON.parse(sessionStorage.getItem("atlas:session") ?? "{}") as { turns?: ChatTurn[]; selectedId?: string | null };
        if (Array.isArray(savedSession.turns)) setTurns(savedSession.turns.slice(-24));
        if (typeof savedSession.selectedId === "string") setSelectedId(savedSession.selectedId);
      } catch { /* Optional continuity. */ }
      setSessionReady(true);
      setThemeReady(true);
      const hour = new Date().getHours(); setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
    }, 0);
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") setMobileNav(false); if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(v => !v); } }
    document.addEventListener("keydown", keydown);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", keydown); abortChat.current?.abort(); };
  }, []);
  useEffect(() => { if (!themeReady) return; document.documentElement.dataset.atlasTheme = theme; try { localStorage.setItem("atlas:theme", theme); } catch { /* Optional preference. */ } }, [theme, themeReady]);
  useEffect(() => {
    if (!window.atlasDesktop?.isNative) return;
    document.documentElement.classList.add("atlas-native");
    const unsubscribe = window.atlasDesktop.onSurface(next => setSurface(next));
    void window.atlasDesktop.getConfig().then(config => setSurface(config.surface));
    return () => { unsubscribe(); document.documentElement.classList.remove("atlas-native"); };
  }, []);
  useEffect(() => { window.atlasDesktop?.setSurface(surface); }, [surface]);
  useEffect(() => { if (!sessionReady) return; try { localStorage.setItem("atlas:surface", surface); sessionStorage.setItem("atlas:session", JSON.stringify({ turns: turns.slice(-24), selectedId })); } catch { /* Optional continuity. */ } }, [surface, turns, selectedId, sessionReady]);
  function openSource(id: string) { const source = sources.find(s => s.id === id); if (!source) { ws.setNotice("That source is no longer in this workspace. Refresh and try again."); return; } if (["email", "message"].includes(source.sourceType)) { setSelectedId(id); navigate("inbox"); } else { setKnowledgeSource(source); navigate("knowledge"); } }
  async function ask(text: string, sourceId?: string) {
    if (!user) { ws.setNotice("Sign in to ask Atlas about your connected workspace."); return; }
    if (chatInFlight.current) return;
    chatInFlight.current = true;
    const id = crypto.randomUUID();
    const contextId = sourceId ?? (surface !== "workspace" || view === "chat" ? selectedId : undefined);
    if (sourceId) setSelectedId(sourceId);
    const history = turns.slice(-12).map(t => ({ role: t.role, content: t.text, referencedMessageIds: t.references?.map(r => r.id) }));
    setTurns(current => [...current, { id: crypto.randomUUID(), role: "user", text }, { id, role: "assistant", text: "" }]);
    setChatBusy(true); setChatStatus("Reviewing your saved sources…"); navigate("chat");
    const controller = new AbortController(); abortChat.current = controller;
    try {
      const response = await fetch("/api/nova/chat", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", accept: "application/x-ndjson" }, body: JSON.stringify({ message: text, page: view, selectedMessageId: contextId, conversation: history, stream: true }) });
      if (!response.ok) { const error = await response.json() as { error?: string }; throw new Error(error.error || "Atlas could not respond."); }
      const reader = response.body?.getReader(); if (!reader) throw new Error("No response received.");
      const decoder = new TextDecoder(); let buffer = "";
      function consume(line: string) {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { type: string; text?: string; references?: Reference[] };
        if (event.type === "status") setChatStatus(event.text ?? "Preparing response…");
        if (event.type === "text") setTurns(current => current.map(t => t.id === id ? { ...t, text: t.text + (event.text ?? "") } : t));
        if (event.type === "references") setTurns(current => current.map(t => t.id === id ? { ...t, references: event.references } : t));
        if (event.type === "error") throw new Error(event.text || "Atlas could not respond.");
      }
      while (true) { const part = await reader.read(); buffer += decoder.decode(part.value, { stream: !part.done }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; lines.forEach(consume); if (part.done) break; }
      if (buffer.trim()) consume(buffer);
    } catch (error) { setTurns(current => current.map(t => t.id === id ? { ...t, text: t.text || (controller.signal.aborted ? "Response stopped." : error instanceof Error ? error.message : "Atlas is temporarily unavailable. Try again.") } : t)); }
    finally { setChatBusy(false); chatInFlight.current = false; abortChat.current = null; }
  }
  async function connect(provider: Provider, displayName?: string) {
    setBusyProvider(provider);
    try { const result = await api<{ redirectUrl: string }>("/api/nova/connect", { provider, displayName }); const url = new URL(result.redirectUrl); if (url.protocol !== "https:") throw new Error("A secure sign-in URL was not returned."); window.location.assign(url.href); }
    catch (e) { ws.setNotice(e instanceof Error ? e.message : "Connection unavailable."); } finally { setBusyProvider(null); }
  }
  async function createDraft(source: Source) {
    if (actionBusy) return; setActionBusy(true);
    try { const result = await api<{ subject: string; body: string }>("/api/nova/draft", { senderName: parseSourceTitle(source.title).sender, subject: parseSourceTitle(source.title).subject, body: source.content });
      setDraft({ recipient: parseSourceTitle(source.title).address ?? "", subject: result.subject, body: result.body, sourceId: source.id });
    } catch (e) { ws.setNotice(e instanceof Error ? e.message : "Draft unavailable."); } finally { setActionBusy(false); }
  }
  async function prepareTrash(source: Source) {
    if (!gmail || !source.externalId) { ws.setNotice("This message does not have a connected Gmail action available."); return; }
    setActionBusy(true);
    try { const proposal = await api<NovaActionProposal>("/api/nova/actions/propose", { intent: "ARCHIVE_MESSAGE", accountId: gmail.id, targetId: source.id, summary: `Move “${source.title}” to Gmail Trash`, arguments: { message_id: source.externalId } }); setPending({ kind: "trash", proposal, source }); }
    catch (e) { ws.setNotice(e instanceof Error ? e.message : "Could not prepare the action."); } finally { setActionBusy(false); }
  }
  async function executePending() {
    if (!pending || actionBusy) return; setActionBusy(true);
    try {
      if (pending.kind === "trash" && pending.proposal) { const result = await api<{ message: string; status: string }>("/api/nova/actions/execute", { proposal: pending.proposal, confirmedProposalId: pending.proposal.id }); ws.setNotice(result.message); ws.addActivity(result.message, "success"); }
      else if (pending.source) { const response = await fetch(`/api/nova/workspace/${encodeURIComponent(pending.source.id)}`, { method: "DELETE" }); if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "Could not remove the item."); } ws.setNotice("Removed from Atlas. The original remains in its app."); ws.addActivity("Removed a saved copy from Atlas", "success"); }
      setPending(null); await ws.refresh();
    } catch (e) { ws.setNotice(e instanceof Error ? e.message : "Action failed. Try again."); } finally { setActionBusy(false); }
  }
  async function saveCapture(event: React.FormEvent) {
    event.preventDefault(); setActionBusy(true);
    try { await api("/api/nova/workspace", { title: captureTitle, content: captureBody, sourceType: captureType }); setCapture(false); setCaptureTitle(""); setCaptureBody(""); ws.addActivity("Saved a note with a zero-call summary", "success"); await ws.refresh(); }
    catch (e) { ws.setNotice(e instanceof Error ? e.message : "Could not save your note."); } finally { setActionBusy(false); }
  }
  const navLabel = view === "apps" ? "Connected apps" : view === "settings" ? "Settings" : NAV.find(n => n.id === view)?.label;
  return <main className={`atlas-shell surface-${surface}`}>
    <a className="skip-link" href="#atlas-main">Skip to workspace</a><div className="ambient-background" aria-hidden="true" />
    <aside className={`atlas-sidebar${mobileNav ? " is-open" : ""}`}><button className="atlas-brand" onClick={() => navigate("home")} aria-label="Atlas home"><AtlasMark size={38} /><span>Atlas<small>Your intelligent workspace</small></span></button>
      <button className="sidebar-search" onClick={() => setPalette(true)}><Icon name="search" size={16} /><span>Ask or search</span><kbd>⌘ K</kbd></button>
      <nav aria-label="Main navigation">{NAV.map(item => <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><Icon name={item.id} /><span>{item.label}</span>{item.id === "inbox" && briefing.replies > 0 && <small>{briefing.replies}</small>}</button>)}</nav>
      <div className="sidebar-connections"><p>Connected</p>{ws.connections.length ? ws.connections.slice(0, 4).map(c => <button key={c.id} onClick={() => navigate("apps")}><AppLogo provider={c.provider} size={18} /><span>{c.label}</span><i className={c.status === "active" ? "status-dot connected" : "status-dot"} /></button>) : <button onClick={() => navigate("apps")}><Icon name="plus" size={18} /><span>Add your apps</span></button>}<button className={view === "apps" ? "active" : ""} onClick={() => navigate("apps")}><Icon name="apps" size={18} /><span>Manage apps</span></button></div>
      <div className="sidebar-bottom"><button onClick={() => navigate("settings")} aria-current={view === "settings" ? "page" : undefined}><Icon name="settings" /><span>Settings</span></button><div className="profile-row"><span className="profile-avatar">{user?.displayName?.slice(0, 1).toUpperCase() ?? "A"}</span><div><strong>{user?.displayName ?? "Your workspace"}</strong><small>{user ? "Personal workspace" : "Sign in to get started"}</small></div></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="atlas-main"><header className="atlas-topbar"><div><button className="icon-button mobile-menu" onClick={() => setMobileNav(v => !v)} aria-label="Toggle navigation" aria-expanded={mobileNav}><Icon name="menu" /></button><span>{navLabel}</span></div><div><AtlasStatus state={chatBusy ? "thinking" : ws.restoring || ws.syncing.length ? "working" : "idle"}>{chatBusy ? "Thinking" : ws.restoring ? "Restoring workspace" : ws.syncing.length ? "Syncing" : "Ready"}</AtlasStatus>{user && <button className="icon-button" aria-label="Refresh workspace" title="Refresh workspace" disabled={ws.restoring || ws.syncing.length > 0} onClick={() => void ws.sync()}><Icon name="refresh" size={18} /></button>}</div></header>
      {ws.notice && <div className="atlas-notice" role="status"><span>{ws.notice}</span><button className="icon-button" onClick={() => ws.setNotice("")} aria-label="Dismiss notice"><Icon name="close" size={16} /></button></div>}
      {ws.data?.demo && <div className="demo-notice">Demonstration data · Live storage is unavailable in this preview.</div>}
      <div id="atlas-main" className={`atlas-page view-${view}`} key={view}>
        {!user ? <section className="atlas-welcome"><AtlasMark size={88} /><p className="eyebrow">Your intelligent workspace</p><h1>A little less noise.<br />A lot more clarity.</h1><p>Bring your messages, ideas, and next steps together.<br />Let Atlas help you see what matters.</p><a className="primary" href="/signin-with-chatgpt?return_to=%2Fworkspace" target="_top">Open workspace<Icon name="arrow" size={18} /></a><div className="welcome-providers"><AppLogo provider="gmail" /><AppLogo provider="outlook" /><AppLogo provider="linkedin" /></div><small>Your connected accounts. Your decisions.</small></section>
        : view === "home" ? <section className="home-workspace"><div className="home-intro"><div className="home-identity"><AtlasMark size={46} /><span>Here with you</span></div><h1>{greeting}{user.displayName && !user.displayName.includes("@") ? `, ${user.displayName.split(" ")[0]}` : ""}.</h1><p className="home-briefing">{ws.loading ? "Restoring your workspace…" : briefing.text}</p><ConnectedCluster connections={ws.connections} restoring={ws.restoring} syncing={ws.syncing} onOpen={() => navigate("apps")} /></div>
          <AtlasComposer disabled={ws.loading} busy={chatBusy} onSend={text => void ask(text)} /><div className="suggestion-row">{briefing.suggestions.map(text => <button key={text} onClick={() => void ask(text)} disabled={ws.loading}>{text}<Icon name="arrow" size={14} /></button>)}</div>
          <section className="attention-feed"><div className="section-heading"><h2>{briefing.attention.length ? "Worth your attention" : "Recently in your workspace"}</h2><button className="text-button" onClick={() => navigate("inbox")}>Open inbox<Icon name="arrow" size={15} /></button></div>{ws.loading ? <div className="workspace-skeleton" aria-label="Loading workspace"><i /><i /><i /></div> : (briefing.attention.length ? briefing.attention : briefing.ranked).slice(0, 3).map(({ source, intelligence }, i) => <article className="attention-item" key={source.id}><span className="attention-index">0{i + 1}</span><div><div className="attention-source"><AppLogo provider={source.provider} size={17} /><span>{source.accountLabel}</span><span>·</span><time>{relativeTime(source.occurredAt)}</time></div><h3>{parseSourceTitle(source.title).subject}</h3><p>{source.summary}</p><div className="attention-actions"><button className="text-button" onClick={() => openSource(source.id)}>Review<Icon name="arrow" size={14} /></button>{intelligence.requiresResponse && <button className="text-button muted" disabled={actionBusy} onClick={() => void createDraft(source)}>Draft a reply</button>}</div></div></article>)}{!ws.loading && !briefing.ranked.length && <div className="home-empty"><Icon name="apps" size={28} /><div><h3>Give Atlas a little context.</h3><p>Connect Gmail or save a note to get started.</p></div><button className="secondary" onClick={() => navigate("apps")}>Connect an app</button></div>}</section><p className="home-footnote">Recommendations are based on your latest saved sources. You always decide what happens next.</p>
        </section>
        : view === "inbox" ? <Inbox sources={sources} selectedId={selectedId} onSelect={setSelectedId} onAsk={(t, id) => void ask(t, id)} onDraft={s => void createDraft(s)} onTrash={s => void prepareTrash(s)} onRemove={s => setPending({ kind: "remove", source: s })} busy={chatBusy || actionBusy} />
        : view === "chat" ? <Chat turns={turns} busy={chatBusy} status={chatStatus} onSend={text => void ask(text)} onStop={() => abortChat.current?.abort()} onOpen={openSource} onNew={() => { setTurns([]); setSelectedId(null); }} context={selected?.title} />
        : view === "apps" ? <ConnectedApps connections={ws.connections} restoring={ws.restoring} syncing={ws.syncing} errors={ws.connectionErrors} onConnect={(p, name) => void connect(p, name)} onSync={p => void ws.sync([p])} busy={busyProvider} />
        : view === "knowledge" ? <section className="standard-page"><p className="eyebrow">Keep the useful things close</p><div className="section-heading"><h1>Your knowledge</h1><button className="primary" onClick={() => setCapture(true)}><Icon name="plus" size={17} />Save a note</button></div><p className="page-intro">Notes, documents, and context you can come back to.</p><label className="inbox-search"><Icon name="search" size={17} /><input placeholder="Search saved knowledge" aria-label="Search saved knowledge" value={knowledgeQuery} onChange={e => setKnowledgeQuery(e.target.value)} /></label><div className="knowledge-list">{sources.filter(s => !["email", "message"].includes(s.sourceType) && `${s.title} ${s.content}`.toLowerCase().includes(knowledgeQuery.toLowerCase())).map(source => <SourceRow key={source.id} source={source} onOpen={() => setKnowledgeSource(source)} />)}</div>{!sources.some(s => !["email", "message"].includes(s.sourceType)) && <div className="empty-state"><Icon name="knowledge" size={36} /><h2>A place for what you learn.</h2><p>Save your first note. Atlas keeps a searchable summary alongside the original.</p></div>}</section>
        : view === "calendar" ? <section className="standard-page"><p className="eyebrow">Make room for what matters</p><h1>Your calendar</h1><p className="page-intro">Meeting context, without guessing your availability.</p><div className="empty-state"><Icon name="calendar" size={44} /><h2>Calendar sync isn’t configured yet.</h2><p>Atlas can help find scheduling requests in your messages. It won’t claim you’re free without calendar data.</p><button className="secondary" onClick={() => void ask("Find scheduling and meeting requests")}>Review scheduling messages<Icon name="arrow" size={16} /></button></div><a className="text-button" href="/overview">Open regional context and existing overview<Icon name="external" size={16} /></a></section>
        : view === "activity" ? <section className="standard-page"><p className="eyebrow">A little transparency</p><h1>While you work</h1><p className="page-intro">Connection syncs and actions from this session.</p><div className="activity-list">{ws.activity.map(item => <article key={item.id}><Icon name={item.kind === "success" ? "check" : "activity"} size={18} /><p>{item.text}</p><time>{relativeTime(item.at)}</time></article>)}{!ws.activity.length && <div className="empty-state"><AtlasMark size={48} /><h2>Nothing to report yet.</h2><p>When Atlas syncs an app or completes an action, you’ll see it here.</p></div>}</div></section>
        : <section className="standard-page"><p className="eyebrow">Make yourself at home</p><h1>Workspace settings</h1><div className="settings-row"><div><h2>Appearance</h2><p>Choose the light that works for you.</p></div><div className="filter-tabs" role="group" aria-label="Theme">{["dark", "light"].map(t => <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === "dark" ? "Dark" : "Light"}</button>)}</div></div><div className="settings-row"><div><h2>Motion</h2><p>Atlas follows your device’s reduced-motion preference.</p></div><Icon name="activity" /></div><div className="settings-row"><div><h2>Connected apps</h2><p>Valid connections restore automatically. Syncs pause while this tab is hidden.</p></div><button className="secondary" onClick={() => navigate("apps")}>Manage</button></div><div className="settings-row"><div><h2>Assistant</h2><p>Source-grounded answers include a written synthesis and links back to the supporting workspace items.</p></div></div><div className="settings-row"><div><h2>{user.email}</h2><p>Signed in to your private workspace.</p></div><a className="secondary" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></div><a className="text-button" href="/overview">Regional context and existing overview<Icon name="external" size={15} /></a></section>}
      </div>
      {user && !["chat", "home", "inbox"].includes(view) && <div className="floating-ask"><button onClick={() => navigate("chat")}><AtlasMark size={24} /><span>Ask Atlas about your workspace</span><Icon name="arrow" size={16} /></button></div>}
    </div>
    {user && surface === "workspace" && <button className="compose-shortcut" title="Compose Gmail email" aria-label="Compose Gmail email" onClick={() => setDraft({ recipient: "", subject: "", body: "", sourceId: "compose" })}><Icon name="plus" size={22} /></button>}
    {user && <AtlasCompanion surface={surface} onSurface={setSurface} sources={sources} connections={ws.connections} turns={turns} busy={chatBusy} status={chatStatus} onAsk={(text, id) => void ask(text, id)} onOpen={source => { setSurface("workspace"); openSource(source.id); }} onDraft={source => void createDraft(source)} onApps={() => { setSurface("workspace"); navigate("apps"); }} />}
    {palette && <Dialog title="Ask Atlas or run a command" onClose={() => setPalette(false)} className="command-palette"><form onSubmit={e => { e.preventDefault(); setPalette(false); void ask(command); setCommand(""); }}><label className="command-input"><Icon name="search" /><input value={command} onChange={e => setCommand(e.target.value)} placeholder="Ask Atlas or run a command…" aria-label="Command or question" /></label>{command.trim() && <button className="command-item" type="submit"><AtlasMark size={22} />Ask Atlas: {command}<Icon name="arrow" size={16} /></button>}</form><div className="command-list">{[...NAV, { id: "apps" as const, label: "Connected apps" }, { id: "settings" as const, label: "Settings" }].filter(item => item.label.toLowerCase().includes(command.toLowerCase())).map(item => <button className="command-item" key={item.id} onClick={() => { navigate(item.id); setCommand(""); }}><Icon name={item.id} />Open {item.label}<Icon name="arrow" size={16} /></button>)}</div></Dialog>}
    {draft && <DraftDialog initial={draft} accountId={gmail?.id} onClose={() => setDraft(null)} onDone={message => { ws.setNotice(message); ws.addActivity(message, "success"); }} />}
    {pending && <Dialog title={pending.kind === "trash" ? "Move this email to Gmail Trash?" : "Remove the saved copy?"} onClose={() => { if (!actionBusy) setPending(null); }}><p className="dialog-intro">{pending.source?.title}</p><p>{pending.kind === "trash" ? "This changes the actual email in Gmail. You can recover it from Gmail Trash." : "The original stays in its app. Atlas may import it again on the next sync."}</p><footer><button className="secondary" disabled={actionBusy} onClick={() => setPending(null)}>Cancel</button><button className="primary" disabled={actionBusy} onClick={() => void executePending()}>{actionBusy ? "Working…" : pending.kind === "trash" ? "Confirm move" : "Remove from Atlas"}</button></footer></Dialog>}
    {capture && <Dialog title="Save a little context" onClose={() => setCapture(false)}><form onSubmit={saveCapture}><label>Title<input value={captureTitle} onChange={e => setCaptureTitle(e.target.value)} placeholder="What is this about?" maxLength={180} /></label><label>Type<select value={captureType} onChange={e => setCaptureType(e.target.value)}>{["note", "meeting", "research", "document"].map(t => <option key={t}>{t}</option>)}</select></label><label>Content<textarea rows={8} required maxLength={20000} value={captureBody} onChange={e => setCaptureBody(e.target.value)} placeholder="Add notes, an idea, or useful context…" /></label><footer><span>A private, searchable summary is included.</span><button className="primary" disabled={actionBusy}>{actionBusy ? "Saving…" : "Save note"}</button></footer></form></Dialog>}
    {knowledgeSource && <Dialog title={knowledgeSource.title} onClose={() => setKnowledgeSource(null)}><div className="detail-source"><AppLogo provider={knowledgeSource.provider} size={20} /><span>{knowledgeSource.sourceType}</span></div><p className="message-body">{knowledgeSource.content}</p><footer><button className="secondary" onClick={() => { setPending({ kind: "remove", source: knowledgeSource }); setKnowledgeSource(null); }}>Remove saved copy</button></footer></Dialog>}
  </main>;
}
