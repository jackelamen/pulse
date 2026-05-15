const BAD_HOST_PARTS = ["0.0.0.0", "extapp-sock"];

export function appOrigin(request: Request) {
  const configured = cleanOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  const origin = cleanOrigin(request.headers.get("origin"));
  if (origin) return origin;

  const forwardedHost = cleanHost(firstHeaderValue(request.headers.get("x-forwarded-host")));
  if (forwardedHost) {
    const proto = firstHeaderValue(request.headers.get("x-forwarded-proto")) || "https";
    return `${proto}://${forwardedHost}`;
  }

  const host = cleanHost(request.headers.get("host"));
  if (host) {
    const proto = firstHeaderValue(request.headers.get("x-forwarded-proto")) || "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export function appUrl(path: string, request: Request) {
  return new URL(path, appOrigin(request));
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function cleanOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!cleanHost(url.host)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function cleanHost(value: string | null | undefined) {
  if (!value) return null;
  if (BAD_HOST_PARTS.some((part) => value.includes(part))) return null;
  if (value.startsWith("/")) return null;
  return value;
}
