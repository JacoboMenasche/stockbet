import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's market IDs first
  const markets = await prisma.market.findMany({
    where: { betDate: today },
    select: { id: true },
  });
  const marketIds = markets.map((m) => m.id);

  // Delete related records in dependency order
  await prisma.probabilitySnapshot.deleteMany({ where: { marketId: { in: marketIds } } });
  await prisma.trade.deleteMany({ where: { marketId: { in: marketIds } } });
  await prisma.order.deleteMany({ where: { marketId: { in: marketIds } } });
  await prisma.position.deleteMany({ where: { marketId: { in: marketIds } } });
  await prisma.watchlist.deleteMany({ where: { marketId: { in: marketIds } } });

  const deleted = await prisma.market.deleteMany({ where: { id: { in: marketIds } } });

  console.log(`Deleted ${deleted.count} markets for today (${today.toDateString()})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
