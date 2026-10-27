"use client";
import { useEffect, useState } from "react";

type Report = { jobs: { discovered:number; eligible:number; needsReview:number; salaryKnown:number; discoveredLast7Days:number }; applications: { attempts:number; confirmed:number; unverified:number; exceptions:number; confirmedLast7Days:number }; generatedAt:number; autonomousSubmissionsEnabled:false };

export function CareerOverview() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  async function refresh() { const response = await fetch("/api/career/report", { cache: "no-store" }); const body = await response.json() as Report & { error?:string }; if (!response.ok) throw new Error(body.error ?? "Career overview unavailable"); setData(body); setError(""); }
  useEffect(() => { let active = true; fetch("/api/career/report", { cache: "no-store" }).then(async response => { const body = await response.json() as Report & { error?:string }; if (!response.ok) throw new Error(body.error ?? "Career overview unavailable"); if (active) setData(body); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Career overview unavailable"); }); return () => { active = false; }; }, []);
  return <div className="career-overview">
    <div className="section-heading"><h2>Career overview</h2><button className="secondary" type="button" onClick={() => void refresh().catch(cause => setError(cause instanceof Error ? cause.message : "Career overview unavailable"))}>Refresh</button></div>
    <p className="page-intro">Counts come from your saved Career records. Application attempts and confirmed submissions are tracked separately.</p>
    {error && <div className="career-error" role="alert">{error}</div>}
    {!data ? <p>Loading Career totals…</p> : <>
      <div className="career-metrics"><div><strong>{data.jobs.discovered}</strong><span>Discovered jobs</span></div><div><strong>{data.jobs.eligible}</strong><span>Eligible jobs</span></div><div><strong>{data.jobs.needsReview}</strong><span>Jobs needing review</span></div><div><strong>{data.applications.confirmed}</strong><span>Confirmed applications</span></div><div><strong>{data.applications.unverified}</strong><span>Unverified attempts</span></div><div><strong>{data.applications.exceptions}</strong><span>Application exceptions</span></div></div>
      <section className="career-panel"><h3>Last seven days</h3><p>{data.jobs.discoveredLast7Days} newly discovered jobs · {data.applications.confirmedLast7Days} confirmed applications</p><p>Salary was published in annual USD for {data.jobs.salaryKnown} of {data.jobs.discovered} saved jobs. Missing salary remains unknown.</p><p>Interview conversion will appear after interview outcomes can be tracked; no rate is inferred from missing data.</p><small>Updated {new Date(data.generatedAt).toLocaleString()}</small></section>
    </>}
    <section className="career-panel"><h3>Download your records</h3><p>Exports include only your saved Career records. A blank salary or confirmation field means it is unknown or unavailable.</p><div className="career-pilot-actions"><a className="secondary" href="/api/career/report?format=jobs.csv">Download jobs CSV</a><a className="secondary" href="/api/career/report?format=applications.csv">Download applications CSV</a></div></section>
  </div>;
}
