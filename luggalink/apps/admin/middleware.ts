import jwt from "jsonwebtoken";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME ?? "ll_admin_token";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET ?? "") as { role?: string };
    if (payload.role !== "ADMIN") {
      throw new Error("Not an admin");
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next|api/health|favicon.ico).*)"],
};
