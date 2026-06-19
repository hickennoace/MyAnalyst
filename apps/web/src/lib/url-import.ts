// Import a dataset from a public URL by fetching it into a File, then handing it to the normal parser.
// Privacy note: this PULLS data in from a URL the user chose - none of their own data is sent anywhere,
// and no MyAnalyst server is involved (the browser fetches directly). Cross-origin URLs that don't send
// CORS headers will be blocked by the browser; we surface a clear message in that case.

/** Rewrite a Google Sheets URL to its CSV-export endpoint so it can be read directly. (A sheet shared
 *  "anyone with the link" / "published to web" can be fetched; private sheets will fail with a clear
 *  message.) Non-Sheets URLs pass through unchanged. */
export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "docs.google.com" && u.pathname.includes("/spreadsheets/")) {
      const id = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (id) {
        const gid = u.hash.match(/gid=(\d+)/)?.[1] ?? u.searchParams.get("gid") ?? "0";
        return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

/** Derive a safe, extension-bearing filename from a URL (so the parser can pick the right reader). */
export function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    let name = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
    name = name.replace(/[^a-z0-9._-]/gi, "_");
    if (!name) name = "remote-data";
    if (!/\.[a-z0-9]+$/i.test(name)) name += ".csv"; // default to CSV when the URL has no extension
    return name;
  } catch {
    return "remote-data.csv";
  }
}

/** Fetch a public URL (incl. Google Sheets) and wrap the response as a File for the existing parser. */
export async function fetchAsFile(url: string): Promise<File> {
  const target = normalizeSourceUrl(url);
  let res: Response;
  try {
    res = await fetch(target, { redirect: "follow" });
  } catch {
    // A network/CORS failure throws a TypeError with no useful detail in the browser.
    throw new Error("Couldn't fetch that URL - the site may block cross-origin requests. Try downloading the file and uploading it.");
  }
  if (!res.ok) throw new Error(`The server returned ${res.status} ${res.statusText || ""}`.trim() + ".");
  const blob = await res.blob();
  return new File([blob], filenameFromUrl(url), { type: blob.type || "text/csv" });
}
