"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "../../lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const response = await fetch(`${process.env.API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    return { error: "Invalid credentials" };
  }

  const data = (await response.json()) as { accessToken?: string };
  if (!data.accessToken) {
    return { error: "Invalid credentials" };
  }

  try {
    verifyAdminToken(data.accessToken);
  } catch {
    return { error: "This account does not have admin access" };
  }

  cookies().set(ADMIN_COOKIE_NAME, data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });

  redirect("/dashboard");
}
