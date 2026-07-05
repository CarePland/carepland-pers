import type { NextConfig } from "next";

const configuredDevOrigins = [
  process.env.CONNECT_LAN_HOST,
  process.env.CONNECT_HTTPS_LAN_HOST,
  hostnameFromUrl(process.env.CONNECT_RECEIVER_SETUP_BASE_URL),
].filter((value): value is string => Boolean(value));

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...configuredDevOrigins,
    "192.168.7.59",
    "10.0.2.2",
  ],
};

export default nextConfig;

function hostnameFromUrl(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
