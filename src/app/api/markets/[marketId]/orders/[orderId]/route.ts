import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrderAction, OrderStatus } from "@prisma/client";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string; orderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true, action: true, price: true, shares: true, filledShares: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PARTIALLY_FILLED) {
    return NextResponse.json({ error: "Order cannot be cancelled" }, { status: 400 });
  }

  const unfilledShares = order.shares - order.filledShares;
  const refund =
    order.action === OrderAction.BUY && order.price !== null
      ? order.price * unfilledShares
      : 0;

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    if (refund > 0) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { cashBalanceCents: { increment: BigInt(refund) } },
      });
    }
  });

  return NextResponse.json({ cancelled: true, refundCents: refund });
}
