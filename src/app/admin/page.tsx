import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { EarningsPanel } from "@/components/admin/EarningsPanel";
import { MarketsPanel } from "@/components/admin/MarketsPanel";
import { ResolvePanel } from "@/components/admin/ResolvePanel";
import { SyncPanel } from "@/components/admin/SyncPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!isAdmin(session)) redirect("/");

  const { tab = "earnings" } = await searchParams;

  const companies = await db.company.findMany({
    select: { id: true, ticker: true, name: true },
    orderBy: { ticker: "asc" },
  });

  const earnings = tab === "earnings" || tab === "markets" || tab === "resolve"
    ? await db.earningsEvent.findMany({
        include: { company: true, _count: { select: { markets: true } } },
        orderBy: { reportDate: "asc" },
      })
    : null;

  const markets = tab === "markets" || tab === "resolve"
    ? await db.market.findMany({
        where: tab === "resolve" ? { status: { in: ["OPEN", "CLOSED"] } } : { status: "OPEN" },
        include: { company: true, earningsEvent: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const settingsData = tab === "settings"
    ? await db.setting.findUnique({ where: { key: "resolutionPrompt" } })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-2">Admin</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Manage earnings, markets, and resolutions
        </p>
      </div>

      <Suspense>
        <AdminTabs />
      </Suspense>

      {tab === "earnings" && earnings && (
        <EarningsPanel earnings={earnings} companies={companies} />
      )}
      {tab === "markets" && earnings && markets && (
        <MarketsPanel markets={markets} earnings={earnings} companies={companies} />
      )}
      {tab === "resolve" && markets && (
        <ResolvePanel markets={markets} />
      )}
      {tab === "sync" && <SyncPanel />}
      {tab === "settings" && (
        <SettingsPanel initialPrompt={settingsData?.value ?? ""} />
      )}
    </div>
  );
}
