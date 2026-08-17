export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || url.host;
  const protocol = forwardedProtocol || url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function secureRequest(request: Request) {
  return requestOrigin(request).startsWith("https://") || process.env.NODE_ENV === "production";
}
