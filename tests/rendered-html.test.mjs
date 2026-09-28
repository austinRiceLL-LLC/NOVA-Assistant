import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Atlas with a private sign-in entry and no fabricated inbox", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Atlas/);
  assert.match(html, /intelligent workspace/i);
  assert.match(html, /A little less noise/i);
  assert.match(html, /Open workspace/i);
  assert.doesNotMatch(html, /DEMO DATA|Priya Shah/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|react-loading-skeleton/i);
});

test("ships durable storage configuration without connector secrets", async () => {
  const [hostingText, envExample, gitignore, schema, workspace] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace/workspace-client.tsx", import.meta.url), "utf8"),
  ]);
  const hosting = JSON.parse(hostingText);

  assert.equal(hosting.d1, "DB");
  assert.match(envExample, /^COMPOSIO_API_KEY=$/m);
  assert.doesNotMatch(envExample, /^COMPOSIO_API_KEY=\S+/m);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(schema, /export const connectorAccounts/);
  assert.match(schema, /export const consentGrants/);
  assert.match(schema, /export const auditEntries/);
  assert.match(schema, /summaryStrategy/);
  assert.match(workspace, /zero-call summary/i);
});
