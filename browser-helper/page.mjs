// This function is serialized into the current tab by chrome.scripting. Keep it
// self-contained, and never collect or return the applicant's existing answers.
export function inspectAndFill(mode, profile) {
  const fields = [];
  let filledCount = 0;
  if (location.protocol !== "https:") throw new Error("Open a secure employer application page first");
  if (/(^|\.)(linkedin\.com|indeed\.com|ziprecruiter\.com|joinhandshake\.com)$/.test(location.hostname)) {
    throw new Error("This helper does not run on this job board");
  }
  const sensitive = /password|social security|\bssn\b|birth|date of birth|dob|payment|credit card|bank|passport|driver.?s? license|gender|race|ethnic|disab|veteran|citizen|authorization|sponsor|clearance|salary|compensation|cover letter|why (?:do|are)|experience|search|captcha|verification/i;
  const mapped = [
    ["email", /^(?:email|email address|e mail)$/i],
    ["phone", /^(?:phone|phone number|mobile|mobile phone|telephone)$/i],
    ["fullName", /^(?:full name|legal name|name)$/i],
    ["preferredName", /^(?:preferred name|chosen name)$/i],
    ["city", /^(?:city|current city)$/i],
    ["region", /^(?:state|state or province|state or region|province|region)$/i],
    ["country", /^(?:country|country of residence)$/i],
    ["linkedinUrl", /^(?:linkedin|linkedin url|linkedin profile|linkedin profile url)$/i],
    ["portfolioUrl", /^(?:portfolio|portfolio url|portfolio website|personal website|website)$/i],
    ["githubUrl", /^(?:github|github url|github profile|github profile url)$/i],
    ["school", /^(?:school|college|university|school name)$/i],
    ["degree", /^(?:degree|highest degree)$/i],
    ["graduationDate", /^(?:graduation date|graduation year)$/i],
    ["availability", /^(?:availability|available start date|start date)$/i],
  ];
  const autocomplete = { name: "fullName", nickname: "preferredName", email: "email", tel: "phone", "address-level2": "city", "address-level1": "region", country: "country", "country-name": "country" };
  const controls = [...document.querySelectorAll("input, textarea, select")].slice(0, 150);
  for (const element of controls) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
    if (element.disabled || element.closest("[hidden], [aria-hidden='true']") || element.getClientRects().length === 0) continue;
    const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : element.tagName.toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    const labelText = [...(element.labels ?? [])].map(label => label.textContent?.trim() ?? "").filter(Boolean).join(" ");
    const raw = labelText || element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.getAttribute("name") || element.id || "Unlabeled field";
    const label = raw.replace(/\s+/g, " ").replace(/\*$/, "").trim().slice(0, 160);
    const signal = [label, element.getAttribute("name"), element.id, element.getAttribute("autocomplete")].filter(Boolean).join(" ");
    const textControl = ["text", "email", "tel", "url", "textarea"].includes(type);
    const auto = element.getAttribute("autocomplete")?.toLowerCase().trim() ?? "";
    const normalized = label.replace(/[\s_*:-]+/g, " ").trim();
    const key = !sensitive.test(signal) && textControl
      ? (autocomplete[auto] ?? mapped.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null)
      : null;
    const compatible = type === "text" || type === "textarea" || (type === "email" && key === "email") || (type === "tel" && key === "phone") || (type === "url" && ["linkedinUrl", "portfolioUrl", "githubUrl"].includes(key));
    const value = key && profile && typeof profile[key] === "string" ? profile[key].trim() : "";
    const canFill = Boolean(key && compatible && value && !element.readOnly && !element.value);
    if (mode === "fill" && canFill) {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) {
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        filledCount++;
      }
    }
    fields.push({ label: sensitive.test(signal) ? "Sensitive question" : label, status: key && compatible ? (value ? (canFill ? "ready" : "already entered or locked") : "matched; import details to fill") : "review manually" });
  }
  return { origin: location.origin, fields: fields.slice(0, 100), filledCount };
}
