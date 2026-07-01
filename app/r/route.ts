import { NextResponse } from "next/server";

const defaultSetupCode = "12345";

export function GET(request: Request) {
  const url = new URL(request.url);
  const setupCode = url.searchParams.get("code")?.trim() || defaultSetupCode;
  const target = new URL("/connect/receiver/setup", url);

  target.searchParams.set("code", setupCode);

  for (const key of ["device", "hardwareProfile", "uiLayout"]) {
    const value = url.searchParams.get(key)?.trim();
    if (value) {
      target.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(target);
}
