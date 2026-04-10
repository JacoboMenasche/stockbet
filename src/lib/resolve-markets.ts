import { db } from "@/lib/db";
import { MarketStatus, MetricType, Side } from "@prisma/client";
import { fetchQuote } from "@/lib/fmp";
import { resolveChallengesForDate, awardPerformanceBonuses } from "@/lib/challenges";

function determineWinner(
  metricType: MetricType,
  threshold: number,
  quote: { price: number; open: number; previousClose: number }
): { winningSide: Side; actualValue: number; actualLabel: string } {
  switch (metricType) {
    case MetricType.PRICE_DIRECTION: {
      const won = quote.price > quote.previousClose;
      return {
        winningSide: won ? Side.YES : Side.NO,
        actualValue: quote.price,
        actualLabel: `$${quote.price.toFixed(2)}`,
      };
    }
    case MetricType.PERCENTAGE_MOVE: {
      const move =
        Math.abs(((quote.price - quote.open) / quote.open) * 100);
      const won = move > threshold;
      return {
        winningSide: won ? Side.YES : Side.NO,
        actualValue: move,
        actualLabel: `${move.toFixed(2)}%`,
      };
    }
    case MetricType.PRICE_TARGET: {
      const won = quote.price >= threshold;
      return {
        winningSide: won ? Side.YES : Side.NO,
        actualValue: quote.price,
        actualLabel: `$${quote.price.toFixed(2)}`,
      };
    }
  }
}

async function resolveMarket(
  marketId: string,
  winningSide: Side,
  actualValue: number,
  actualLabel: string
) {
  await db.$transaction(async (tx) => {
    await tx.resolution.create({
      data: {
        marketId,
        actualValue,
        actualLabel,
        winningSide,
        sourceFiling: "auto-resolution",
      },
    });

    await tx.market.update({
      where: { id: marketId },
      data: { status: MarketStatus.RESOLVED },
    });

    const positions = await tx.position.findMany({ where: { marketId } });

    for (const position of positions) {
      const won = position.side === winningSide;
      const totalCost = position.shares * position.avgCostCents;

      if (won) {
        const payout = position.shares * 100;
        await tx.user.update({
          where: { id: position.userId },
          data: { cashBalanceCents: { increment: BigInt(payout) } },
        });
        await tx.position.update({
          where: { id: position.id },
          data: { realizedPL: payout - totalCost, currentPrice: 100, unrealizedPL: 0 },
        });
      } else {
        await tx.position.update({
          where: { id: position.id },
          data: { realizedPL: -totalCost, currentPrice: 0, unrealizedPL: 0 },
        });
      }
    }

    await tx.resolution.update({
      where: { marketId },
      data: { payoutsIssuedAt: new Date() },
    });
  });
}

export async function resolveAllOpenMarketsForToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const markets = await db.market.findMany({
    where: { betDate: today, status: MarketStatus.OPEN },
    include: { company: { select: { ticker: true } } },
  });

  if (markets.length === 0) return;

  // Group by ticker to minimize FMP calls (one quote per company)
  const byTicker = new Map<string, typeof markets>();
  for (const m of markets) {
    const list = byTicker.get(m.company.ticker) ?? [];
    list.push(m);
    byTicker.set(m.company.ticker, list);
  }

  for (const [ticker, tickerMarkets] of byTicker) {
    let quote;
    try {
      quote = await fetchQuote(ticker);
    } catch {
      console.error(`[resolve] Failed to fetch quote for ${ticker}`);
      continue;
    }
    if (!quote) continue;

    for (const market of tickerMarkets) {
      try {
        const { winningSide, actualValue, actualLabel } = determineWinner(
          market.metricType,
          Number(market.threshold),
          quote
        );

        await resolveMarket(market.id, winningSide, actualValue, actualLabel);

        console.log(
          `[resolve] ${ticker} ${market.metricType} → ${winningSide} (${actualLabel})`
        );
      } catch (err) {
        console.error(`[resolve] Failed for market ${market.id}:`, err);
      }
    }
  }

  // Resolve any challenges whose markets settled today
  try {
    await resolveChallengesForDate(today);
  } catch (err) {
    console.error("[resolve] Challenge resolution failed:", err);
  }

  // Award performance bonuses to eligible users
  try {
    await awardPerformanceBonuses();
  } catch (err) {
    console.error("[resolve] Performance bonus failed:", err);
  }
}
