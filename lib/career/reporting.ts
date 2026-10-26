export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let text = String(value);
  if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvDocument(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function csvDate(timestamp: number | null): string {
  return timestamp === null ? "" : new Date(timestamp).toISOString();
}
