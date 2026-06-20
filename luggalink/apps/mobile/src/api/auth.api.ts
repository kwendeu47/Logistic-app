import { apiClient } from "./client";
import type { User, UserRole } from "../types";

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface RegisterInput {
  email: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Exclude<UserRole, "ADMIN">;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>("/auth/register", input);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>("/auth/login", { email, password });
  return data;
}

export async function verifyPhone(otp: string): Promise<{ user: User }> {
  const { data } = await apiClient.post<{ user: User }>("/auth/verify-phone", { otp });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getMe(): Promise<{ user: User }> {
  const { data } = await apiClient.get<{ user: User }>("/users/me");
  return data;
}

export async function registerDeviceToken(expoPushToken: string, platform: "ios" | "android"): Promise<void> {
  await apiClient.post("/users/me/device-token", { expoPushToken, platform });
}

export async function createKycSession(): Promise<{ clientSecret: string | null; url: string | null }> {
  const { data } = await apiClient.post<{ clientSecret: string | null; url: string | null }>(
    "/users/me/kyc-session",
  );
  return data;
}
