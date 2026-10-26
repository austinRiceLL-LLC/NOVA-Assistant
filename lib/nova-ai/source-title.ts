// The import normalizer stores "subject — sender". Do not search the body for
// recipient addresses: quoted messages may mention unrelated people.
export function parseSourceTitle(title: string, fallback = "Message") {
  const split = title.lastIndexOf(" — ");
  const subject = split < 0 ? title : title.slice(0, split);
  const rawSender = split < 0 ? fallback : title.slice(split + 3).trim();
  const address = rawSender.match(/(?:<|^)([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?$/)?.[1];
  const name = rawSender.replace(/\s*<[^>]+>\s*$/, "").trim() || address || fallback;
  return { subject, sender: name, address };
}
