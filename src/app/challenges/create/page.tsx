import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";
import { CreateChallengeForm } from "@/components/challenges/CreateChallengeForm";
import { isAfterMarketClose } from "@/lib/create-daily-markets";

export const dynamic = "force-dynamic";

export default async function CreateChallengePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openMarkets = await db.market.findMany({
    where: { status: MarketStatus.OPEN, betDate: today },
    select: { id: true, question: true, company: { select: { ticker: true } } },
    orderBy: [{ company: { ticker: "asc" } }, { metricType: "asc" }],
  });

  // Determine if this user is an admin
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
  const isAdmin = !!user && adminEmails.includes(user.email);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-1">Create Challenge</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Pick markets from today, set an entry fee, and share the link
        </p>
      </div>

      {openMarkets.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {isAfterMarketClose()
              ? "Markets have closed for today. Check back tomorrow morning."
              : "No open markets available right now."}
          </p>
        </div>
      ) : (
        <CreateChallengeForm openMarkets={openMarkets} isAdmin={isAdmin} />
      )}
    </div>
  );
}
