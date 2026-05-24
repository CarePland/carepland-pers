import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarePland | Complete the appointment loop",
  description:
    "CarePland helps patients and caregivers bring forward the context that matters for the next medical appointment.",
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
