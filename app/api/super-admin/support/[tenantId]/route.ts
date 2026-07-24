import { NextResponse } from "next/server";
import { authorizeSuperAdmin, isSameOrigin } from "../../../../../lib/api-auth";
import { startSupportMode } from "../../../../../lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { tenantId } = await params;
  const started = await startSupportMode(auth.context.user.id, tenantId);
  if (!started) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });
  return NextResponse.json({ ok: true, redirectTo: "/teacher" });
}