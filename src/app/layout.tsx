import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { SessionProviderWrapper } from "@/components/auth/SessionProviderWrapper";

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
      <body className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: "var(--color-brand)", color: "var(--color-text-main)" }}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" disableTransitionOnChange>
          {/* Ambient background blooms */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full" style={{ background: "var(--bloom-mint)", filter: "blur(140px)", opacity: 0.07 }} />
            <div className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full" style={{ background: "var(--bloom-coral)", filter: "blur(140px)", opacity: 0.06 }} />
            <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full" style={{ background: "var(--bloom-yellow)", filter: "blur(140px)", opacity: 0.04 }} />
            <div className="absolute top-2/3 left-0 w-[450px] h-[450px] rounded-full" style={{ background: "var(--bloom-crimson)", filter: "blur(160px)", opacity: 0.05 }} />
            <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] rounded-full" style={{ background: "var(--bloom-beige)", filter: "blur(150px)", opacity: 0.04 }} />
          </div>
          <SessionProviderWrapper>
            {/* Desktop sidebar */}
            <Suspense>
              <Sidebar />
            </Suspense>

            {/* Main content shifted right on desktop */}
            <div className="sidebar-main">
              <TopNav />
              <main className="app-shell relative">{children}</main>
            </div>

            {/* Mobile bottom nav */}
            <Suspense>
              <BottomNav />
            </Suspense>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
