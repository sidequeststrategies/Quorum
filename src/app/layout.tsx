import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quorum — Board management for startups",
  description: "Run better board meetings, track resolutions, and keep your cap-side governance tight.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
