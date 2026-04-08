import "dotenv/config";
import { PrismaClient, MarketStatus, MetricType } from "@prisma/client";
import { fetchHistoricalPrices } from "./fmp";
import { determineWinningSide } from "./lib/market-helpers";

const db = new PrismaClient();

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface PriceData {
  open: number;
  close: number;
}

function computeResolution(
  metricType: MetricType,
  threshold: number,
  price: PriceData
): { actualValue: number; actualLabel: string } {
  switch (metricType) {
    case MetricType.PRICE_DIRECTION: {
      const diff = price.close - price.open;
      return {
        actualValue: diff,
        actualLabel: diff > 0 ? "Up" : diff < 0 ? "Down" : "Flat",
      };
    }
    case MetricType.PRICE_TARGET: {
      return {
        actualValue: price.close,
        actualLabel: `$${price.close.toFixed(2)}`,
      };
    }
    case MetricType.PERCENTAGE_MOVE: {
      const pctMove = Math.abs((price.close - price.open) / price.open) * 100;
      return {
        actualValue: pctMove,
        actualLabel: `${pctMove.toFixed(2)}%`,
      };
    }
  }
}

async function resolveDailyBets() {
  const today = todayDate();
  console.log(`[resolve] Resolving bets for ${today.toISOString().split("T")[0]}`);

  const markets = await db.market.findMany({
    where: { betDate: today, status: MarketStatus.OPEN },
    include: { company: true },
  });

  if (markets.length === 0) {
    console.log("[resolve] No open markets for today.");
    return;
  }

  // Group by company to minimize API calls
  const byCompany = new Map<string, typeof markets>();
  for (const m of markets) {
    const list = byCompany.get(m.companyId) ?? [];
    list.push(m);
    byCompany.set(m.companyId, list);
  }

  for (const [companyId, companyMarkets] of byCompany) {
    const ticker = companyMarkets[0].company.ticker;

    // Fetch today's price from FMP
    const prices = await fetchHistoricalPrices(ticker, 1);
    const todayPrice = prices[0];

    if (!todayPrice) {
      console.warn(`[resolve] ${ticker}: no price data for today — skipping`);
      continue;
    }

    const price: PriceData = {
      open: todayPrice.open,
      close: todayPrice.close,
    };

    for (const market of companyMarkets) {
      const threshold = Number(market.threshold);
      const { actualValue, actualLabel } = computeResolution(
        market.metricType,
        threshold,
        price
      );
      const winningSide = determineWinningSide(actualValue, threshold);

      await db.$transaction(async (tx) => {
        const resolution = await tx.resolution.create({
          data: {
            marketId: market.id,
            actualValue,
            actualLabel,
            winningSide,
            sourceFiling: `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${ticker}`,
          },
        });

        await tx.market.update({
          where: { id: market.id },
          data: { status: MarketStatus.RESOLVED },
        });

        const positions = await tx.position.findMany({
          where: { marketId: market.id },
        });

        for (const position of positions) {
          const won = position.side === winningSide;
          const totalCost = position.shares * position.avgCostCents;

          if (won) {
            const payout = position.shares * 100;
            const realizedPL = payout - totalCost;

            await tx.user.update({
              where: { id: position.userId },
              data: { cashBalanceCents: { increment: BigInt(payout) } },
            });

            await tx.position.update({
              where: { id: position.id },
              data: { realizedPL, currentPrice: 100, unrealizedPL: 0 },
            });

            console.log(`[resolve] ${ticker} ${market.metricType}: paid user ${position.userId} ${payout}¢ (P&L: ${realizedPL > 0 ? "+" : ""}${realizedPL}¢)`);
          } else {
            await tx.position.update({
              where: { id: position.id },
              data: { realizedPL: -totalCost, currentPrice: 0, unrealizedPL: 0 },
            });

            console.log(`[resolve] ${ticker} ${market.metricType}: user ${position.userId} lost ${totalCost}¢`);
          }
        }

        await tx.resolution.update({
          where: { id: resolution.id },
          data: { payoutsIssuedAt: new Date() },
        });
      });

      console.log(`[resolve] ${ticker} ${market.metricType}: actual=${actualLabel}, threshold=${market.thresholdLabel}, winner=${winningSide}`);
    }
  }

  console.log("[resolve] Done.");
}

resolveDailyBets().finally(() => db.$disconnect());
