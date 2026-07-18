import type { Metadata } from "next";
import { HelpDiagnosticsRuntime } from "./components/platform/HelpDiagnosticsRuntime";
import { OfflineRuntime } from "./components/platform/OfflineRuntime";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarePland | Complete the appointment loop",
  description:
    "CarePland helps patients and caregivers bring forward the context that matters for the next medical appointment.",
  icons: {
    apple: [
      {
        sizes: "180x180",
        type: "image/png",
        url: "/apple-touch-icon.png",
      },
    ],
    icon: [
      { sizes: "any", url: "/favicon.ico" },
      {
        sizes: "16x16",
        type: "image/png",
        url: "/favicon-16x16.png",
      },
      {
        sizes: "32x32",
        type: "image/png",
        url: "/favicon-32x32.png",
      },
      {
        sizes: "48x48",
        type: "image/png",
        url: "/favicon-48x48.png",
      },
      {
        sizes: "192x192",
        type: "image/png",
        url: "/icon-192x192.png",
      },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <HelpDiagnosticsRuntime />
        <OfflineRuntime />
        {children}
      </body>
    </html>
  );
}
