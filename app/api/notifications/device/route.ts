import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { isSameOrigin } from "@/lib/api-auth";
import { isPushEligibleRole, summarizeUserAgent } from "@/lib/notifications/security";
import { prisma } from "@/lib/prisma";

const installationId = z.string().uuid();
const registerSchema = z.object({ installationId, token: z.string().trim().min(20).max(4096), permission: z.literal("granted") });
const patchSchema = z.object({ installationId, action: z.enum(["PROMPT_SHOWN", "DISMISS", "PERMISSION", "DISABLE"]), permission: z.enum(["default", "granted", "denied"]).optional() });
async function context() {
  const auth = await getAuthContext();
  return auth?.membership && auth.user.status === "ACTIVE" && auth.membership.status === "ACTIVE" && isPushEligibleRole(auth.user.role) ? auth : null;
}
function publicState(device: { enabled: boolean; token: string | null; permissionState: "DEFAULT" | "GRANTED" | "DENIED" | "UNSUPPORTED"; promptCount: number; promptDismissedAt: Date | null; lastFailureCode: string | null } | null) {
  const cooldown = device?.promptDismissedAt ? new Date(device.promptDismissedAt.getTime() + 259200000) : null;
  return { registered: Boolean(device?.enabled && device.token), enabled: Boolean(device?.enabled), permissionState: device?.permissionState ?? "DEFAULT", promptCount: device?.promptCount ?? 0, cooldownUntil: cooldown?.toISOString() ?? null, needsRetry: Boolean(device?.lastFailureCode && !device.token) };
}
export async function GET(request: Request) {
  const auth = await context();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = installationId.safeParse(new URL(request.url).searchParams.get("installationId"));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "معرّف الجهاز غير صالح" }, { status: 400 });
  const device = await prisma.pushDevice.findUnique({
    where: { tenantId_userId_installationId: { tenantId: auth.membership!.tenantId, userId: auth.user.id, installationId: parsed.data } },
    select: { enabled: true, token: true, permissionState: true, promptCount: true, promptDismissedAt: true, lastFailureCode: true },
  });
  return NextResponse.json({ ok: true, currentDevice: publicState(device) });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const auth = await context();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات الجهاز غير صالحة" }, { status: 400 });
  const tenantId = auth.membership!.tenantId;
  const now = new Date();
  const ua = summarizeUserAgent(request.headers.get("user-agent") ?? "unknown");
  await prisma.$transaction(async (tx) => {
    await tx.pushDevice.updateMany({ where: { token: parsed.data.token, NOT: { tenantId, userId: auth.user.id, installationId: parsed.data.installationId } }, data: { enabled: false, token: null, lastFailureCode: "TOKEN_REASSIGNED", lastFailureAt: now } });
    await tx.pushDevice.upsert({
      where: { tenantId_userId_installationId: { tenantId, userId: auth.user.id, installationId: parsed.data.installationId } },
      update: { token: parsed.data.token, enabled: true, permissionState: "GRANTED", browser: ua.browser, platform: ua.platform, userAgentSummary: ua.summary, lastSeenAt: now, lastFailureCode: null, lastFailureAt: null },
      create: { tenantId, userId: auth.user.id, installationId: parsed.data.installationId, token: parsed.data.token, enabled: true, permissionState: "GRANTED", browser: ua.browser, platform: ua.platform, userAgentSummary: ua.summary, lastSeenAt: now },
    });
  });
  return NextResponse.json({ ok: true });
}
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const auth = await context();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "الإجراء غير صالح" }, { status: 400 });
  const tenantId = auth.membership!.tenantId;
  const userId = auth.user.id;
  const now = new Date();
  const permissionState = parsed.data.permission === "granted" ? "GRANTED" : parsed.data.permission === "denied" ? "DENIED" : "DEFAULT";
  if (parsed.data.action === "DISABLE") {
    await prisma.pushDevice.updateMany({ where: { tenantId, userId, installationId: parsed.data.installationId }, data: { enabled: false, token: null, lastSeenAt: now } });
  } else {
    await prisma.pushDevice.upsert({
      where: { tenantId_userId_installationId: { tenantId, userId, installationId: parsed.data.installationId } },
      update: parsed.data.action === "PROMPT_SHOWN" ? { promptCount: { increment: 1 }, lastPromptedAt: now, lastSeenAt: now } : parsed.data.action === "DISMISS" ? { promptDismissedAt: now, lastSeenAt: now } : { permissionState, ...(permissionState === "DENIED" ? { enabled: false, token: null } : {}), lastSeenAt: now },
      create: { tenantId, userId, installationId: parsed.data.installationId, enabled: false, permissionState, promptCount: parsed.data.action === "PROMPT_SHOWN" ? 1 : 0, lastPromptedAt: parsed.data.action === "PROMPT_SHOWN" ? now : null, promptDismissedAt: parsed.data.action === "DISMISS" ? now : null },
    });
  }
  return NextResponse.json({ ok: true });
}
