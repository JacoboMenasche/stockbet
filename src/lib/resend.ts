import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}`;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    to,
    subject: "Verify your Ratio Markets account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0D1B2A; margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #444; margin-bottom: 24px;">
          Click the button below to verify your Ratio Markets account.
          This link expires in 24 hours.
        </p>
        <a
          href="${verifyUrl}"
          style="display:inline-block;background:#00C2A8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;"
        >
          Verify Email
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
