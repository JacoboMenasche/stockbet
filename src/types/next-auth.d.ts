import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      cashBalanceCents: number;
    } & DefaultSession["user"];
  }
}
