import { NotificationCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { isSameOrigin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const categories = Object.values(NotificationCategory);
const schema = z.object({ preferences: z.array(z.object({ category: z.nativeEnum(NotificationCategory), inApp: z.boolean(), push: z.boolean() })).max(categories.length) });
async function context() {
  const auth = await getAuthContext();
  return auth?.membership && auth.user.status === "ACTIVE" && auth.membership.status === "ACTIVE" ? auth : null;
}
export async function GET() {
  const auth = await context();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const rows = await prisma.notificationPreference.findMany({ where: { tenantId: auth.membership!.tenantId, userId: auth.user.id } });
  const map = new Map(rows.map((row) => [row.category, row]));
  return NextResponse.json({ ok: true, preferences: categories.map((category) => ({ category, inApp: map.get(category)?.inApp ?? true, push: map.get(category)?.push ?? true })) });
}
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const auth = await context();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "الإعدادات غير صالحة" }, { status: 400 });
  const tenantId = auth.membership!.tenantId;
  await prisma.$transaction(parsed.data.preferences.map((preference) => prisma.notificationPreference.upsert({
    where: { tenantId_userId_category: { tenantId, userId: auth.user.id, category: preference.category } },
    update: { inApp: preference.inApp, push: preference.push },
    create: { tenantId, userId: auth.user.id, ...preference },
  })));
  return NextResponse.json({ ok: true });
}
