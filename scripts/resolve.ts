import "dotenv/config";
import { PrismaClient, MarketStatus, MetricType, ReleaseTime } from "@prisma/client";
import { fetchIncomeStatements } from "./fmp";
import { determineWinningSide } from "./lib/market-helpers";

const db = new PrismaClient();

function isPreMarketRun(): boolean {
  const hour = new Date().getHours(); // local time
  return hour < 10; // before 10 AM = pre-market run
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayEnd(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function resolveCompany(ticker: string, companyId: string, eventId: string) {
  // Close all open markets for this event
  await db.market.updateMany({
    where: { earningsEventId: eventId, status: MarketStatus.OPEN },
    data: { status: MarketStatus.CLOSED },
  });
  console.log(`[resolve] Closed markets for ${ticker}`);

  // Fetch actual results
  const statements = await fetchIncomeStatements(ticker, 1);
  const actual = statements[0];
  if (!actual) {
    console.warn(`[resolve] No income statement available yet for ${ticker} — will retry next run`);
    return;
  }

  // Resolve each market
  const markets = await db.market.findMany({
    where: { earningsEventId: eventId, status: MarketStatus.CLOSED },
  });

  for (const market of markets) {
    let actualValue: number | null = null;
    let actualLabel = "";

    if (market.metricType === MetricType.EPS) {
      actualValue = actual.eps;
      actualLabel = `$${actual.eps.toFixed(2)}`;
    } else if (market.metricType === MetricType.GROSS_MARGIN) {
      actualValue = (actual.grossProfit / actual.revenue) * 100;
      actualLabel = `${actualValue.toFixed(1)}%`;
    } else if (market.metricType === MetricType.OPERATING_MARGIN) {
      actualValue = (actual.operatingIncome / actual.revenue) * 100;
      actualLabel = `${actualValue.toFixed(1)}%`;
    } else if (market.metricType === MetricType.REVENUE_GROWTH) {
      await db.market.update({ where: { id: market.id }, data: { status: "VOIDED" } });
      console.warn(`[resolve] ${ticker} REVENUE_GROWTH market voided — prior year data needed`);
      continue;
    }

    if (actualValue === null) continue;

    const threshold = Number(market.threshold);
    const winningSide = determineWinningSide(actualValue, threshold);

    // Resolve + payout in a single transaction
    await db.$transaction(async (tx) => {
      // Create resolution record
      const resolution = await tx.resolution.create({
        data: {
          marketId: market.id,
          actualValue,
          actualLabel,
          winningSide,
          sourceFiling: `https://financialmodelingprep.com/financial-statements/${ticker}`,
        },
      });

      // Mark market as resolved
      await tx.market.update({
        where: { id: market.id },
        data: { status: MarketStatus.RESOLVED },
      });

      // Fetch all positions for this market
      const positions = await tx.position.findMany({
        where: { marketId: market.id },
      });

      // Settle each position
      for (const position of positions) {
        const won = position.side === winningSide;
        const totalCost = position.shares * position.avgCostCents;

        if (won) {
          const payout = position.shares * 100;
          const realizedPL = payout - totalCost;

          // Credit winner's balance
          await tx.user.update({
            where: { id: position.userId },
            data: { cashBalanceCents: { increment: BigInt(payout) } },
          });

          // Update position
          await tx.position.update({
            where: { id: position.id },
            data: {
              realizedPL,
              currentPrice: 100,
              unrealizedPL: 0,
            },
          });

          console.log(`[resolve] ${ticker} ${market.metricType}: paid user ${position.userId} ${payout}¢ (P&L: ${realizedPL > 0 ? "+" : ""}${realizedPL}¢)`);
        } else {
          const realizedPL = -totalCost;

          // Update position
          await tx.position.update({
            where: { id: position.id },
            data: {
              realizedPL,
              currentPrice: 0,
              unrealizedPL: 0,
            },
          });

          console.log(`[resolve] ${ticker} ${market.metricType}: user ${position.userId} lost ${totalCost}¢`);
        }
      }

      // Stamp payouts issued
      await tx.resolution.update({
        where: { id: resolution.id },
        data: { payoutsIssuedAt: new Date() },
      });
    });

    console.log(`[resolve] ${ticker} ${market.metricType}: actual=${actualLabel}, threshold=${market.thresholdLabel}, winner=${winningSide}`);
  }
}

async function main() {
  const runType = isPreMarketRun() ? ReleaseTime.PRE_MARKET : ReleaseTime.POST_MARKET;
  console.log(`[resolve] Running as ${runType} (${new Date().toLocaleTimeString()})`);

  const events = await db.earningsEvent.findMany({
    where: {
      reportDate: { gte: todayStart(), lte: todayEnd() },
      releaseTime: runType,
    },
    include: { company: true },
  });

  if (events.length === 0) {
    console.log("[resolve] No companies reporting today for this window.");
    return;
  }

  for (const event of events) {
    try {
      await resolveCompany(event.company.ticker, event.companyId, event.id);
    } catch (err) {
      console.error(`[resolve] Error for ${event.company.ticker}:`, err);
    }
  }

  console.log("[resolve] Done.");
}

main().finally(() => db.$disconnect());
