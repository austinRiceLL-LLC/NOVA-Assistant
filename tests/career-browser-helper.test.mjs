import assert from "node:assert/strict";
import test from "node:test";
import { inspectAndFill } from "../browser-helper/page.mjs";

test("guided helper fills only empty matched fields and leaves sensitive questions alone", () => {
  const prior = Object.fromEntries(["location", "document", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "Event"].map(key => [key, globalThis[key]]));
  class Input {
    constructor(label, type = "text", value = "", name = "") { this.labels = [{ textContent: label }]; this.type = type; this.value = value; this.name = name; this.disabled = false; this.readOnly = false; this.id = ""; this.events = []; }
    get value() { return this._value; }
    set value(value) { this._value = value; }
    closest() { return null; }
    getClientRects() { return [1]; }
    getAttribute(name) { return name === "name" ? this.name : null; }
    dispatchEvent(event) { this.events.push(event.type); }
  }
  class Textarea extends Input { constructor(label, value = "") { super(label, "textarea", value); this.tagName = "TEXTAREA"; } }
  class Select extends Input { constructor(label) { super(label, "select"); this.tagName = "SELECT"; } }
  class SyntheticEvent { constructor(type) { this.type = type; } }
  const email = new Input("Email address", "email");
  const existing = new Input("Phone", "tel", "already entered");
  const ssn = new Input("Social Security Number", "text", "", "ssn");
  const narrative = new Textarea("Why are you interested?");
  const select = new Select("Country");
  try {
    Object.assign(globalThis, { location: { protocol: "https:", hostname: "jobs.example.com", origin: "https://jobs.example.com" }, document: { querySelectorAll: () => [email, existing, ssn, narrative, select] }, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLSelectElement: Select, Event: SyntheticEvent });
    const report = inspectAndFill("fill", { email: "candidate@example.com", phone: "1234567890", country: "US" });
    assert.equal(report.filledCount, 1);
    assert.equal(email.value, "candidate@example.com");
    assert.deepEqual(email.events, ["input", "change"]);
    assert.equal(existing.value, "already entered");
    assert.equal(ssn.value, "");
    assert.equal(narrative.value, "");
    assert.equal(select.value, "");
    assert.equal(report.fields[2].label, "Sensitive question");
    assert.equal(report.fields[3].status, "review manually");
  } finally { Object.assign(globalThis, prior); }
});
