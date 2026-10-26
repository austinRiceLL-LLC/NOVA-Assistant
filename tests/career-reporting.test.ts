import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, csvDate, csvDocument } from "../lib/career/reporting.ts";

test("CSV escapes quotes and prevents spreadsheet formulas from job board text", () => {
  assert.equal(csvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(csvCell("  +SUM(1,2)"), '"\'  +SUM(1,2)"');
  assert.equal(csvCell(-500), "-500");
  assert.equal(csvDocument(["Role"], [["AI, Engineer"], ["Line\nbreak"]]), '\uFEFF"Role"\r\n"AI, Engineer"\r\n"Line\nbreak"\r\n');
});

test("CSV retains zero while leaving unknown fields blank", () => {
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(null), "");
  assert.equal(csvDate(null), "");
  assert.equal(csvDate(0), "1970-01-01T00:00:00.000Z");
});
