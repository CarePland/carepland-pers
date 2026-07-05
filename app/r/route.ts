import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const setupCode = url.searchParams.get("code")?.trim() || defaultSetupCode();
  const target = new URL("/connect/receiver/setup", receiverSetupRedirectBase(request, url));

  if (setupCode) {
    target.searchParams.set("code", setupCode);
  }

  for (const key of ["device", "hardwareProfile", "uiLayout"]) {
    const value = url.searchParams.get(key)?.trim();
    if (value) {
      target.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(target);
}

function defaultSetupCode() {
  if (
    process.env.CONNECT_RECEIVER_ALLOW_PROTOTYPE_SETUP_CODE === "1" ||
    process.env.NODE_ENV !== "production"
  ) {
    return "12345";
  }
  return "";
}

function receiverSetupRedirectBase(request: Request, requestUrl: URL) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim() || "";
  const host = request.headers.get("host")?.trim() || "";
  const visibleHost = usableHost(forwardedHost) || usableHost(host);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim() || "";
  const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "") || "http";

  if (visibleHost) {
    return `${protocol}://${visibleHost}`;
  }

  const configuredBase = process.env.CONNECT_RECEIVER_SETUP_BASE_URL?.trim() || "";
  if (configuredBase) {
    return configuredBase;
  }

  return requestUrl.origin;
}

function usableHost(host: string) {
  const normalized = host.toLowerCase();
  if (!normalized || normalized.startsWith("0.0.0.0")) return "";
  if (normalized.startsWith("[::]") || normalized.startsWith("::")) return "";
  return host;
}
