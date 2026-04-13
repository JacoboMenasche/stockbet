import { db } from "@/lib/db";
import { fetchNextEarnings } from "@/lib/fmp";

function quarterLabel(reportDate: Date): string {
  const month = reportDate.getMonth() + 1;
  const year = reportDate.getFullYear();
  if (month <= 3) return `Q4-${year - 1}`;
  if (month <= 6) return `Q1-${year}`;
  if (month <= 9) return `Q2-${year}`;
  return `Q3-${year}`;
}

export async function syncEarningsForCompany(companyId: string, ticker: string) {
  // Mark sync time immediately to prevent other requests from triggering a duplicate
  await db.company.update({
    where: { id: companyId },
    data: { lastEarningsSyncAt: new Date() },
  });

  try {
    const earnings = await fetchNextEarnings(ticker);
    if (!earnings) return;

    const reportDate = new Date(earnings.date + "T16:00:00Z");
    const quarter = quarterLabel(reportDate);

    await db.earningsEvent.upsert({
      where: { companyId_quarter: { companyId, quarter } },
      update: { reportDate, isConfirmed: true },
      create: { companyId, quarter, reportDate, isConfirmed: true },
    });
  } catch (err) {
    console.error(`[sync-earnings] Failed for ${ticker}:`, err);
  }
}
