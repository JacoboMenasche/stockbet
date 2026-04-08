import { PrismaClient, MetricType, MarketStatus } from "@prisma/client";

const prisma = new PrismaClient();

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function probabilityHistory(current: number, days = 30) {
  const history = [];
  let price = current + (Math.random() - 0.5) * 20;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    price = Math.max(10, Math.min(90, price + (Math.random() - 0.5) * 3));
    history.push({ probability: Math.round(i === 0 ? current : price), recordedAt: d });
  }
  return history;
}

const COMPANIES = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", prevClose: 189.50 },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Technology", prevClose: 420.30 },
  { ticker: "AMZN", name: "Amazon.com, Inc.", sector: "Consumer Discretionary", prevClose: 185.70 },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Communication Services", prevClose: 163.20 },
  { ticker: "META", name: "Meta Platforms, Inc.", sector: "Communication Services", prevClose: 510.40 },
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology", prevClose: 875.60 },
];

async function main() {
  console.log("Seeding Ratio Markets with daily price bets...");

  const today = todayDate();

  for (const c of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { ticker: c.ticker },
      update: {},
      create: { ticker: c.ticker, name: c.name, sector: c.sector },
    });

    const targetPrice = Math.round(c.prevClose * 1.03 * 100) / 100;

    const bets: {
      metricType: MetricType;
      threshold: number;
      thresholdLabel: string;
      question: string;
      yesPrice: number;
    }[] = [
      {
        metricType: MetricType.PRICE_DIRECTION,
        threshold: 0,
        thresholdLabel: "Up/Down",
        question: `Will ${c.name} close higher than it opened today?`,
        yesPrice: 52,
      },
      {
        metricType: MetricType.PRICE_TARGET,
        threshold: targetPrice,
        thresholdLabel: `$${targetPrice.toFixed(2)}`,
        question: `Will ${c.name} close at or above $${targetPrice.toFixed(2)} today?`,
        yesPrice: 35,
      },
      {
        metricType: MetricType.PERCENTAGE_MOVE,
        threshold: 2,
        thresholdLabel: ">2%",
        question: `Will ${c.name} move more than 2% today?`,
        yesPrice: 28,
      },
    ];

    for (const bet of bets) {
      const existing = await prisma.market.findFirst({
        where: { companyId: company.id, betDate: today, metricType: bet.metricType },
      });

      const market = existing
        ? await prisma.market.update({
            where: { id: existing.id },
            data: {
              yesPriceLatest: bet.yesPrice,
              noPriceLatest: 100 - bet.yesPrice,
              volume24h: Math.floor(Math.random() * 500000) + 100000,
            },
          })
        : await prisma.market.create({
            data: {
              companyId: company.id,
              earningsEventId: null,
              question: bet.question,
              metricType: bet.metricType,
              threshold: bet.threshold,
              thresholdLabel: bet.thresholdLabel,
              status: MarketStatus.OPEN,
              betDate: today,
              yesPriceLatest: bet.yesPrice,
              noPriceLatest: 100 - bet.yesPrice,
              volume24h: Math.floor(Math.random() * 500000) + 100000,
            },
          });

      const snapCount = await prisma.probabilitySnapshot.count({
        where: { marketId: market.id },
      });
      if (snapCount === 0) {
        const snaps = probabilityHistory(bet.yesPrice);
        await prisma.probabilitySnapshot.createMany({
          data: snaps.map((s) => ({ marketId: market.id, ...s })),
        });
      }
    }
  }

  await prisma.setting.upsert({
    where: { key: "resolutionPrompt" },
    update: {},
    create: {
      key: "resolutionPrompt",
      value: `Write a concise resolution disclosure for a binary prediction market. The market question is: {question}. The bet type is {metricType} with a threshold of {thresholdLabel} for {companyName}. The bet resolves at market close on {reportDate}. Explain how and when this market will be resolved, what data source will be used, and under what conditions it resolves YES vs NO. Keep it under 3 sentences. Be formal and precise like Kalshi.`,
    },
  });
  console.log("Seeded default resolution prompt setting");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
