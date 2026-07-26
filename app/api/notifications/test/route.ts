import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, requestFingerprint } from "@/lib/auth";
import { isSameOrigin } from "@/lib/api-auth";
import { sendTestPushToInstallation } from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";

const schema = z.object({ installationId: z.string().uuid() });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const auth = await getAuthContext();
  if (!auth?.membership || auth.user.status !== "ACTIVE") return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "معرّف الجهاز غير صالح" }, { status: 400 });
  const attempts = await prisma.auditLog.count({ where: { actorId: auth.user.id, action: "PUSH_TEST_SENT", createdAt: { gte: new Date(Date.now() - 600000) } } });
  if (attempts >= 3) return NextResponse.json({ ok: false, message: "جرّبت عدة مرات. حاول مجددًا بعد 10 دقائق." }, { status: 429 });
  const result = await sendTestPushToInstallation({ tenantId: auth.membership.tenantId, userId: auth.user.id, installationId: parsed.data.installationId });
  const { ipHash } = await requestFingerprint();
  await prisma.auditLog.create({ data: { tenantId: auth.membership.tenantId, actorId: auth.user.id, action: "PUSH_TEST_SENT", entityType: "PushDevice", metadata: { success: result.ok, reason: result.ok ? null : result.reason }, ipHash } });
  if (!result.ok) return NextResponse.json({ ok: false, message: result.reason === "PROVIDER_NOT_CONFIGURED" ? "خدمة Firebase غير مهيأة على الخادم" : result.reason === "DEVICE_NOT_REGISTERED" ? "فعّل الإشعارات على هذا الجهاز أولًا" : "تعذر إرسال الإشعار التجريبي" }, { status: 503 });
  return NextResponse.json({ ok: true, message: "تم إرسال الإشعار التجريبي إلى هذا الجهاز" });
}
