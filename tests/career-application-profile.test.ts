import { strict as assert } from "node:assert";
import { test } from "node:test";
import { emptyApplicationProfile, validateApplicationProfile, validateResumeFile, maxResumeBytes } from "../lib/career/application-profile.ts";

test("application details remain blank until provided and reject unknown fields", () => {
  const empty = validateApplicationProfile({});
  assert.deepEqual(empty,emptyApplicationProfile());
  assert.throws(() => validateApplicationProfile({ socialSecurityNumber:"123" }), /Invalid application detail field/);
  assert.throws(() => validateApplicationProfile({ portfolioUrl:"javascript:alert(1)" }), /HTTPS URL/);
  assert.throws(() => validateApplicationProfile({ email:"not-an-email" }), /valid email/);
});

test("resume upload accepts matching file signatures and enforces the storage limit", () => {
  assert.equal(validateResumeFile("resume.pdf",new TextEncoder().encode("%PDF-1.7")),"application/pdf");
  assert.equal(validateResumeFile("resume.txt",new TextEncoder().encode("Verified resume text")),"text/plain");
  assert.throws(() => validateResumeFile("resume.pdf",new TextEncoder().encode("not a pdf")),/valid PDF/);
  assert.throws(() => validateResumeFile("resume.txt",new Uint8Array(maxResumeBytes+1)),/750 KB/);
  assert.throws(() => validateResumeFile("../resume.txt",new TextEncoder().encode("hello")),/filename/);
});
