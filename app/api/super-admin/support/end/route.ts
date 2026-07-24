import { NextResponse } from "next/server";
import { authorizeSuperAdmin, isSameOrigin } from "../../../../../lib/api-auth";
import { clearSupportMode } from "../../../../../lib/auth";

export async function POST(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  await clearSupportMode();
  return NextResponse.redirect(new URL("/super-admin", request.url), 303);
}