import { NextResponse } from "next/server";
import { isSameOrigin } from "../../../../lib/api-auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  return NextResponse.json(
    { ok: false, message: "إنشاء حسابات المدرسين متاح للإدارة العليا فقط. تواصل مع إدارة Skoola لتفعيل منصتك." },
    { status: 403 },
  );
}