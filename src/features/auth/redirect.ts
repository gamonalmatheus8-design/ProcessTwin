const fallback = "/processes/new";

/** Keep login/callback destinations on this application, including encoded inputs. */
export function safeAuthNext(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  let decoded = value;
  for (let pass = 0; pass < 3; pass++) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { return fallback; }
  }
  const target = new URL(value, "https://processtwin.invalid");
  if (target.origin !== "https://processtwin.invalid" || /^\/auth(?:\/|$)/.test(target.pathname)) return fallback;
  return `${target.pathname}${target.search}${target.hash}`;
}
