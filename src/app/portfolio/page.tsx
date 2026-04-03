import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { BalanceTopUp } from "@/components/portfolio/BalanceTopUp";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cashBalanceCents: true, lastTopUpAt: true },
  });

  if (!user) redirect("/auth/signin");

  const nextTopUpAt = user.lastTopUpAt
    ? new Date(user.lastTopUpAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;

  const isOnCooldown =
    user.lastTopUpAt !== null &&
    Date.now() - user.lastTopUpAt.getTime() < 24 * 60 * 60 * 1000;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-2">Portfolio</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your balance and open positions
        </p>
      </div>

      <BalanceTopUp
        initialCashBalanceCents={Number(user.cashBalanceCents)}
        initialNextTopUpAt={isOnCooldown ? nextTopUpAt : null}
      />

      <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
        Open positions coming soon.
      </p>
    </div>
  );
}
