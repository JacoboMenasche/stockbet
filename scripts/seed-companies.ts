import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const companies = [
  { ticker: "TSLA", name: "Tesla, Inc." },
  { ticker: "AVGO", name: "Broadcom Inc." },
  { ticker: "LLY", name: "Eli Lilly and Company" },
  { ticker: "JPM", name: "JPMorgan Chase & Co." },
  { ticker: "V", name: "Visa Inc." },
  { ticker: "WMT", name: "Walmart Inc." },
  { ticker: "MA", name: "Mastercard Incorporated" },
  { ticker: "XOM", name: "Exxon Mobil Corporation" },
  { ticker: "UNH", name: "UnitedHealth Group Incorporated" },
  { ticker: "COST", name: "Costco Wholesale Corporation" },
  { ticker: "ORCL", name: "Oracle Corporation" },
  { ticker: "HD", name: "The Home Depot, Inc." },
  { ticker: "NFLX", name: "Netflix, Inc." },
  { ticker: "JNJ", name: "Johnson & Johnson" },
  { ticker: "BAC", name: "Bank of America Corporation" },
  { ticker: "PG", name: "Procter & Gamble Company" },
  { ticker: "AMD", name: "Advanced Micro Devices, Inc." },
  { ticker: "ABBV", name: "AbbVie Inc." },
  { ticker: "CRM", name: "Salesforce, Inc." },
  { ticker: "KO", name: "The Coca-Cola Company" },
  { ticker: "CVX", name: "Chevron Corporation" },
  { ticker: "MRK", name: "Merck & Co., Inc." },
  { ticker: "PEP", name: "PepsiCo, Inc." },
  { ticker: "ACN", name: "Accenture plc" },
  { ticker: "TMO", name: "Thermo Fisher Scientific Inc." },
  { ticker: "CSCO", name: "Cisco Systems, Inc." },
  { ticker: "LIN", name: "Linde plc" },
  { ticker: "ABT", name: "Abbott Laboratories" },
  { ticker: "ADBE", name: "Adobe Inc." },
  { ticker: "MCD", name: "McDonald's Corporation" },
  { ticker: "IBM", name: "International Business Machines Corporation" },
  { ticker: "GE", name: "GE Aerospace" },
  { ticker: "GS", name: "The Goldman Sachs Group, Inc." },
  { ticker: "TXN", name: "Texas Instruments Incorporated" },
  { ticker: "INTU", name: "Intuit Inc." },
  { ticker: "QCOM", name: "QUALCOMM Incorporated" },
  { ticker: "AMGN", name: "Amgen Inc." },
  { ticker: "CAT", name: "Caterpillar Inc." },
  { ticker: "NOW", name: "ServiceNow, Inc." },
  { ticker: "SPGI", name: "S&P Global Inc." },
  { ticker: "RTX", name: "RTX Corporation" },
  { ticker: "BKNG", name: "Booking Holdings Inc." },
  { ticker: "T", name: "AT&T Inc." },
  { ticker: "VZ", name: "Verizon Communications Inc." },
  { ticker: "AXP", name: "American Express Company" },
  { ticker: "BLK", name: "BlackRock, Inc." },
  { ticker: "SCHW", name: "The Charles Schwab Corporation" },
  { ticker: "GILD", name: "Gilead Sciences, Inc." },
  { ticker: "PFE", name: "Pfizer Inc." },
  { ticker: "ISRG", name: "Intuitive Surgical, Inc." },
];

async function main() {
  console.log(`[seed] Upserting ${companies.length} companies...`);
  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const result = await db.company.upsert({
      where: { ticker: company.ticker },
      update: { name: company.name },
      create: { ticker: company.ticker, name: company.name },
    });
    const existing = result.createdAt < new Date(Date.now() - 2000);
    if (!existing) {
      console.log(`[seed] Created: ${company.ticker} — ${company.name}`);
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`[seed] Done. Created: ${created}, Updated/skipped: ${skipped}`);
}

main().finally(() => db.$disconnect());
