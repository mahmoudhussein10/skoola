import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";

export async function POST(request: Request) {
  const auth = await authorizeTenant("tenant.branding.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  return NextResponse.json({ ok: false, message: "تم تحديث نظام رفع ملفات الهوية. حدّث الصفحة واستخدم زر الرفع الجديد." }, { status: 410 });
}