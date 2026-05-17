import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarePland Personal",
  description: "Appointment memory and CarePrep, rebuilt cleanly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
