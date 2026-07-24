import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth";
import { isSameOrigin } from "../../../../lib/api-auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
