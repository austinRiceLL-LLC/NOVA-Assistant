"use client";

import { useEffect } from "react";

export default function LocalSignOutPage() {
  useEffect(() => {
    void fetch("/api/nova/dev-session", { method: "DELETE" }).finally(() => window.location.replace("/"));
  }, []);
  return <main className="local-signin"><div className="local-signin-card"><span>✦ Atlas</span><h1>Closing local session</h1><p>Your localhost demonstration session is being cleared.</p></div></main>;
}
