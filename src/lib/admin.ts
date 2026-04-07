import { Session } from "next-auth";

const ADMIN_EMAILS = ["jmenasche1214@gmail.com"];

export function isAdmin(session: Session | null): boolean {
  return !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
}
