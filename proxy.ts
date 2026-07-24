import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/super-admin/login") return NextResponse.next();
  const hasSession = Boolean(request.cookies.get("chemistry_session")?.value);
  if (hasSession) return NextResponse.next();

  const login = new URL(request.nextUrl.pathname.startsWith("/super-admin") ? "/super-admin/login" : "/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/course/:path*", "/teacher/:path*", "/super-admin/:path*"],
};
