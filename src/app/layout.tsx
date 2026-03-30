import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";

export const metadata: Metadata = {
  title: "Ratio Markets — Prediction markets on financial statements",
  description:
    "Trade Yes/No contracts on earnings metrics — EPS beats, gross margin thresholds, revenue growth — that resolve when official filings publish.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" style={{ backgroundColor: "var(--color-brand)" }}>
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
