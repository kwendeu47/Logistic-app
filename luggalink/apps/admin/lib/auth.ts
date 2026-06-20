import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME ?? "ll_admin_token";

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export function verifyAdminToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET ?? "") as AccessTokenPayload;
  if (payload.role !== "ADMIN") {
    throw new Error("Not an admin token");
  }
  return payload;
}

export function getCurrentAdminId(): string {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    throw new Error("Not authenticated");
  }
  return verifyAdminToken(token).sub;
}
