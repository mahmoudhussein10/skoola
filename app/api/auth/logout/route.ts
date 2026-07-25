import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth";
import { isSameOrigin } from "../../../../lib/api-auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  let next = "/login";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const value = (await request.formData()).get("next");
    if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) next = value;
  }
  await clearSession();
  return NextResponse.redirect(new URL(next, request.url), 303);
}
