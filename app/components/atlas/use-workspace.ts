"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_INTERVAL, syncCandidates, type Activity, type Connection, type WorkspaceData } from "@/lib/atlas/workspace";

export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "This request could not be completed. Try again.");
  return payload as T;
}

export function useWorkspace(identity?: string) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [cached, setCached] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(Boolean(identity));
  const [restoring, setRestoring] = useState(Boolean(identity));
  const [syncing, setSyncing] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const running = useRef(false);
  const lastVerification = useRef(0);
  const mounted = useRef(true);
  const cacheKey = `atlas:connections:${identity ?? "guest"}`;
  const addActivity = useCallback((text: string, kind: Activity["kind"] = "info") => {
    if (mounted.current) setActivity(items => [{ id: crypto.randomUUID(), text, kind, at: Date.now() }, ...items].slice(0, 40));
  }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const payload = await api<WorkspaceData>("/api/nova/workspace", undefined, signal);
    if (mounted.current && !signal?.aborted) {
      setData(payload);
      setLoading(false);
      // Store connection display metadata only, scoped to the signed-in identity.
      try { localStorage.setItem(cacheKey, JSON.stringify(payload.connections.map(({ id, provider, label, status, lastSyncAt }) => ({ id, provider, label, status, lastSyncAt })))); } catch { /* Storage is optional. */ }
    }
    return payload;
  }, [cacheKey]);
  const sync = useCallback(async (providers?: string[], signal?: AbortSignal) => {
    if (!identity || running.current) return;
    running.current = true;
    try {
      let workspace = await refresh(signal);
      if (!workspace.demo && (!providers || providers.length === 0)) {
        setRestoring(true);
        try {
          await api("/api/nova/connections/discover", {}, signal);
          lastVerification.current = Date.now();
          workspace = await refresh(signal);
        } catch (error) {
          if (signal?.aborted) return;
          setNotice("Connection verification is unavailable. Your saved workspace is still here; try Refresh again.");
          addActivity(error instanceof Error ? error.message : "Connection check failed", "error");
          // Do not infer expired authentication from a network/server failure.
          return;
        } finally { if (mounted.current) setRestoring(false); }
      }
      if (workspace.demo) return;
      const candidates = providers?.length
        ? workspace.connections.filter(c => providers.includes(c.provider) && c.status === "active")
        : syncCandidates(workspace.connections);
      setSyncing(candidates.map(c => c.provider));
      await Promise.allSettled(candidates.map(async connection => {
        try {
          const result = await api<{ count: number }>("/api/nova/sync", { provider: connection.provider }, signal);
          if (signal?.aborted || !mounted.current) return;
          setConnectionErrors(current => { const next = { ...current }; delete next[connection.provider]; return next; });
          addActivity(`${connection.label}: ${result.count} ${result.count === 1 ? "item" : "items"} synchronized`, "success");
        } catch {
          if (signal?.aborted || !mounted.current) return;
          setConnectionErrors(current => ({ ...current, [connection.provider]: "Sync unavailable. Try again." }));
          addActivity(`${connection.label} could not sync. Saved items are still available.`, "error");
        } finally { if (mounted.current) setSyncing(current => current.filter(p => p !== connection.provider)); }
      }));
      if (candidates.length && !signal?.aborted) await refresh(signal);
    } catch (error) {
      if (!signal?.aborted && mounted.current) setNotice(error instanceof Error ? error.message : "Workspace unavailable.");
    } finally {
      running.current = false;
      if (mounted.current) { setLoading(false); setRestoring(false); setSyncing([]); }
    }
  }, [identity, refresh, addActivity]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const start = window.setTimeout(() => {
      if (!identity) return;
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(cacheKey) ?? "[]");
        if (Array.isArray(saved)) setCached(saved.filter((item): item is Connection => typeof item?.id === "string" && typeof item?.provider === "string" && typeof item?.label === "string"));
      } catch { /* Ignore malformed or unavailable browser storage. */ }
      void sync(undefined, controller.signal);
    }, 0);
    const check = () => {
      if (identity && document.visibilityState === "visible" && Date.now() - lastVerification.current >= SYNC_INTERVAL) void sync(undefined, controller.signal);
    };
    const interval = window.setInterval(check, SYNC_INTERVAL);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => { mounted.current = false; controller.abort(); window.clearTimeout(start); window.clearInterval(interval); document.removeEventListener("visibilitychange", check); window.removeEventListener("online", check); };
  }, [identity, cacheKey, sync]);
  return { data, connections: data?.connections ?? cached, loading, restoring, syncing, notice, setNotice, refresh, sync, activity, addActivity, connectionErrors };
}
