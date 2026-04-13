import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = "jmenasche1214@gmail.com";
  const newPassword = "Jaco14122004$";

  const hashed = await bcrypt.hash(newPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashed,
      emailVerified: new Date(),
    },
    create: {
      email,
      password: hashed,
      emailVerified: new Date(),
      cashBalanceCents: 100000,
    },
  });

  console.log(`User ready: ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
