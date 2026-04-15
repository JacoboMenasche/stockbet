import Link from "next/link";
import { TrendingUp, Mail } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-brand)" }}
    >
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ backgroundColor: "var(--color-yes)" }}
          >
            <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">
            Ratio Markets
          </span>
        </div>

        <div
          className="glass-card p-8"
          style={{
            backgroundColor: "rgba(11, 28, 42, 0.7)",
          }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-4"
            style={{ backgroundColor: "rgba(148,228,132,0.1)" }}
          >
            <Mail className="h-6 w-6" style={{ color: "var(--color-yes)" }} />
          </div>

          <h1 className="text-lg font-medium text-white mb-2">Check your inbox</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            We sent a verification link to your email address. Click it to activate your account.
          </p>

          <Link
            href="/auth/signin"
            className="text-sm underline hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
