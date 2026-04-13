// scripts/run-resolve-markets.ts
import * as dotenv from "dotenv";
dotenv.config();

import { resolveAllOpenMarketsForToday } from "../src/lib/resolve-markets";

async function main() {
  console.log("[scheduler] Starting market resolution...");
  await resolveAllOpenMarketsForToday();
  console.log("[scheduler] Market resolution complete.");
}

main().catch((err) => {
  console.error("[scheduler] Market resolution failed:", err);
  process.exit(1);
});
