import { NextResponse } from "next/server";
import { notifySubscriptionLifecycle } from "@/lib/notifications/events";
import { processSubscriptionLifecycle } from "@/lib/subscriptions";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await processSubscriptionLifecycle();
  await Promise.all(result.notices.map((notice) => notifySubscriptionLifecycle({ ...notice, graceDays: result.graceDays }).catch(() => undefined)));
  return NextResponse.json({ ok: true, processed: result.processed, notices: result.notices.length });
}