import * as dotenv from "dotenv";
dotenv.config();

import { createPhase1Markets } from "@/lib/create-daily-markets";

async function main() {
  const dateArg = process.argv[2];
  if (!dateArg) {
    console.error("Usage: npx tsx scripts/create-markets-for-date.ts YYYY-MM-DD");
    process.exit(1);
  }

  // Parse as local date (not UTC) to avoid timezone shift
  const [year, month, day] = dateArg.split("-").map(Number);
  const target = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (isNaN(target.getTime())) {
    console.error("Invalid date:", dateArg);
    process.exit(1);
  }

  console.log("Creating Phase 1 markets for:", target.toDateString());
  await createPhase1Markets(target);
  console.log("Done.");
}

main().catch(console.error).finally(() => process.exit(0));
