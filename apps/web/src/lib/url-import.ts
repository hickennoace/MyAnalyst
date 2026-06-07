// Import a dataset from a public URL by fetching it into a File, then handing it to the normal parser.
// Privacy note: this PULLS data in from a URL the user chose — none of their own data is sent anywhere,
// and no MyAnalyst server is involved (the browser fetches directly). Cross-origin URLs that don't send
// CORS headers will be blocked by the browser; we surface a clear message in that case.

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

/** Fetch a public URL and wrap the response as a File for the existing parse pipeline. */
export async function fetchAsFile(url: string): Promise<File> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    // A network/CORS failure throws a TypeError with no useful detail in the browser.
    throw new Error("Couldn't fetch that URL — the site may block cross-origin requests. Try downloading the file and uploading it.");
  }
  if (!res.ok) throw new Error(`The server returned ${res.status} ${res.statusText || ""}`.trim() + ".");
  const blob = await res.blob();
  return new File([blob], filenameFromUrl(url), { type: blob.type || "text/csv" });
}
