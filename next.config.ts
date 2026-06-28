import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    process.env.CONNECT_HTTPS_LAN_HOST || "192.168.7.59",
    "10.0.2.2",
  ],
};

export default nextConfig;
