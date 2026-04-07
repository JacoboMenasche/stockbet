import { PrismaClient, MetricType, MarketStatus } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(16, 0, 0, 0); // 4pm ET earnings release
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
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon.com, Inc.", sector: "Consumer Discretionary" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Communication Services" },
  { ticker: "META", name: "Meta Platforms, Inc.", sector: "Communication Services" },
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
];

const MARKET_TEMPLATES: {
  ticker: string;
  reportsInDays: number;
  markets: {
    question: string;
    metricType: MetricType;
    threshold: number;
    thresholdLabel: string;
    yesPrice: number;
    consensusEstimate: string;
    priorPeriod: string;
    analystRangeLow: number;
    analystRangeHigh: number;
    volume24h: number;
  }[];
}[] = [
  {
    ticker: "AAPL",
    reportsInDays: 12,
    markets: [
      {
        question: "Will Apple gross margin exceed 47%?",
        metricType: MetricType.GROSS_MARGIN,
        threshold: 47.0,
        thresholdLabel: "> 47%",
        yesPrice: 64,
        consensusEstimate: "46.8%",
        priorPeriod: "46.2%",
        analystRangeLow: 45.9,
        analystRangeHigh: 47.4,
        volume24h: 284500,
      },
      {
        question: "Will Apple EPS beat $1.55?",
        metricType: MetricType.EPS,
        threshold: 1.55,
        thresholdLabel: "> $1.55",
        yesPrice: 71,
        consensusEstimate: "$1.54",
        priorPeriod: "$1.46",
        analystRangeLow: 1.48,
        analystRangeHigh: 1.62,
        volume24h: 391200,
      },
    ],
  },
  {
    ticker: "MSFT",
    reportsInDays: 8,
    markets: [
      {
        question: "Will Microsoft EPS beat $3.15?",
        metricType: MetricType.EPS,
        threshold: 3.15,
        thresholdLabel: "> $3.15",
        yesPrice: 72,
        consensusEstimate: "$3.12",
        priorPeriod: "$2.94",
        analystRangeLow: 3.05,
        analystRangeHigh: 3.22,
        volume24h: 512300,
      },
      {
        question: "Will Microsoft revenue growth exceed 14%?",
        metricType: MetricType.REVENUE_GROWTH,
        threshold: 14.0,
        thresholdLabel: "> 14%",
        yesPrice: 58,
        consensusEstimate: "13.7%",
        priorPeriod: "12.3%",
        analystRangeLow: 12.8,
        analystRangeHigh: 15.1,
        volume24h: 298700,
      },
    ],
  },
  {
    ticker: "AMZN",
    reportsInDays: 15,
    markets: [
      {
        question: "Will Amazon operating margin exceed 10%?",
        metricType: MetricType.OPERATING_MARGIN,
        threshold: 10.0,
        thresholdLabel: "> 10%",
        yesPrice: 55,
        consensusEstimate: "9.8%",
        priorPeriod: "7.8%",
        analystRangeLow: 8.5,
        analystRangeHigh: 11.2,
        volume24h: 445600,
      },
      {
        question: "Will Amazon revenue growth exceed 11%?",
        metricType: MetricType.REVENUE_GROWTH,
        threshold: 11.0,
        thresholdLabel: "> 11%",
        yesPrice: 61,
        consensusEstimate: "10.9%",
        priorPeriod: "10.5%",
        analystRangeLow: 10.1,
        analystRangeHigh: 12.3,
        volume24h: 376800,
      },
    ],
  },
  {
    ticker: "GOOGL",
    reportsInDays: 21,
    markets: [
      {
        question: "Will Alphabet EPS beat $2.20?",
        metricType: MetricType.EPS,
        threshold: 2.2,
        thresholdLabel: "> $2.20",
        yesPrice: 68,
        consensusEstimate: "$2.17",
        priorPeriod: "$1.89",
        analystRangeLow: 2.05,
        analystRangeHigh: 2.31,
        volume24h: 334100,
      },
    ],
  },
  {
    ticker: "META",
    reportsInDays: 11,
    markets: [
      {
        question: "Will Meta revenue growth exceed 16%?",
        metricType: MetricType.REVENUE_GROWTH,
        threshold: 16.0,
        thresholdLabel: "> 16%",
        yesPrice: 74,
        consensusEstimate: "16.2%",
        priorPeriod: "18.9%",
        analystRangeLow: 14.5,
        analystRangeHigh: 18.1,
        volume24h: 489200,
      },
      {
        question: "Will Meta operating margin exceed 40%?",
        metricType: MetricType.OPERATING_MARGIN,
        threshold: 40.0,
        thresholdLabel: "> 40%",
        yesPrice: 62,
        consensusEstimate: "39.5%",
        priorPeriod: "41.3%",
        analystRangeLow: 37.8,
        analystRangeHigh: 42.0,
        volume24h: 267400,
      },
    ],
  },
  {
    ticker: "NVDA",
    reportsInDays: 6,
    markets: [
      {
        question: "Will NVIDIA gross margin exceed 73%?",
        metricType: MetricType.GROSS_MARGIN,
        threshold: 73.0,
        thresholdLabel: "> 73%",
        yesPrice: 66,
        consensusEstimate: "72.8%",
        priorPeriod: "74.6%",
        analystRangeLow: 70.5,
        analystRangeHigh: 75.0,
        volume24h: 1043000,
      },
      {
        question: "Will NVIDIA revenue growth exceed 70%?",
        metricType: MetricType.REVENUE_GROWTH,
        threshold: 70.0,
        thresholdLabel: "> 70%",
        yesPrice: 48,
        consensusEstimate: "68.3%",
        priorPeriod: "94.0%",
        analystRangeLow: 60.0,
        analystRangeHigh: 80.0,
        volume24h: 876500,
      },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding Ratio Markets...");

  // Upsert companies
  for (const c of COMPANIES) {
    await prisma.company.upsert({
      where: { ticker: c.ticker },
      update: {},
      create: c,
    });
  }

  // Create earnings events + markets
  for (const template of MARKET_TEMPLATES) {
    const company = await prisma.company.findUniqueOrThrow({
      where: { ticker: template.ticker },
    });

    const event = await prisma.earningsEvent.upsert({
      where: { companyId_quarter: { companyId: company.id, quarter: "Q1-2026" } },
      update: {},
      create: {
        companyId: company.id,
        quarter: "Q1-2026",
        reportDate: daysFromNow(template.reportsInDays),
        isConfirmed: true,
      },
    });

    for (const m of template.markets) {
      const existing = await prisma.market.findFirst({
        where: { earningsEventId: event.id, metricType: m.metricType },
      });

      const market = existing
        ? await prisma.market.update({
            where: { id: existing.id },
            data: {
              yesPriceLatest: m.yesPrice,
              noPriceLatest: 100 - m.yesPrice,
              volume24h: m.volume24h,
            },
          })
        : await prisma.market.create({
            data: {
              companyId: company.id,
              earningsEventId: event.id,
              question: m.question,
              metricType: m.metricType,
              threshold: m.threshold,
              thresholdLabel: m.thresholdLabel,
              status: MarketStatus.OPEN,
              consensusEstimate: m.consensusEstimate,
              priorPeriod: m.priorPeriod,
              analystRangeLow: m.analystRangeLow,
              analystRangeHigh: m.analystRangeHigh,
              yesPriceLatest: m.yesPrice,
              noPriceLatest: 100 - m.yesPrice,
              volume24h: m.volume24h,
            },
          });

      // Seed probability snapshots if none exist
      const snapCount = await prisma.probabilitySnapshot.count({
        where: { marketId: market.id },
      });
      if (snapCount === 0) {
        const snaps = probabilityHistory(m.yesPrice);
        await prisma.probabilitySnapshot.createMany({
          data: snaps.map((s) => ({ marketId: market.id, ...s })),
        });
      }
    }
  }

  // Seed default resolution prompt setting
  await prisma.setting.upsert({
    where: { key: "resolutionPrompt" },
    update: {},
    create: {
      key: "resolutionPrompt",
      value: `Write a concise resolution disclosure for a binary prediction market. The market question is: {question}. The metric is {metricType} with a threshold of {thresholdLabel} for {companyName}. The earnings report date is {reportDate}. Explain how and when this market will be resolved, what data source will be used, and under what conditions it resolves YES vs NO. Keep it under 3 sentences. Be formal and precise like Kalshi.`,
    },
  });
  console.log("Seeded default resolution prompt setting");

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
