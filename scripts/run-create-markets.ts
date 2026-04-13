// scripts/run-create-markets.ts
import * as dotenv from "dotenv";
dotenv.config();

import { createDailyMarkets } from "../src/lib/create-daily-markets";

async function main() {
  console.log("[scheduler] Starting daily market creation...");
  await createDailyMarkets();
  console.log("[scheduler] Market creation complete.");
}

main().catch((err) => {
  console.error("[scheduler] Market creation failed:", err);
  process.exit(1);
});
