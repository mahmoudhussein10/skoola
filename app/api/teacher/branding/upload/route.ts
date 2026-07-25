import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";

export async function POST(request: Request) {
  const auth = await authorizeTenant("tenant.branding.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  return NextResponse.json({ ok: false, message: "تم نقل رفع ملفات الهوية إلى نظام Bunny الآمن. حدّث الصفحة واستخدم رافع الوسائط الجديد." }, { status: 410 });
}