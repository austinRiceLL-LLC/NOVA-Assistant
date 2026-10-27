import { getChatGPTUser } from "@/app/chatgpt-auth";
import { exportCareerCsv, loadCareerReport } from "@/lib/career/reporting-store";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to use Career." }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format");
  if (format !== null && format !== "jobs.csv" && format !== "applications.csv") return Response.json({ error: "Unknown export format." }, { status: 400 });
  try {
    if (format) {
      const kind = format === "jobs.csv" ? "jobs" : "applications";
      const csv = await exportCareerCsv(user, kind);
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="atlas-career-${kind}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return Response.json(await loadCareerReport(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const tooLarge = error instanceof Error && error.message.startsWith("Export exceeds");
    return Response.json({ error: tooLarge ? error.message : "Career report is temporarily unavailable." }, { status: tooLarge ? 413 : 503 });
  }
}
