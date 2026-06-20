import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as authService from "../services/auth.service";
import { UnauthorizedError } from "../utils/errors";
import { REFRESH_TOKEN_COOKIE, refreshCookieOptions } from "../utils/jwt";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["SENDER", "TRAVELER", "BOTH"]),
});

router.post("/register", validate(registerSchema), async (req, res) => {
  const result = await authService.register(req.body);
  res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, refreshCookieOptions());
  res.status(201).json(result);
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, refreshCookieOptions());
  res.json(result);
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!refreshToken) {
    throw new UnauthorizedError("Missing refresh token");
  }

  const result = await authService.refreshAccessToken(refreshToken);
  res.json(result);
});

const verifyPhoneSchema = z.object({
  otp: z.string().length(6),
});

router.post("/verify-phone", requireAuth, validate(verifyPhoneSchema), async (req, res) => {
  const user = await authService.verifyPhone(req.user!.id, req.body.otp);
  res.json({ user });
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/auth" });
  res.status(204).send();
});

export default router;
