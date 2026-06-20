import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";
import { twilioClient } from "../../config/twilio";
import { comparePassword, hashPassword } from "../../utils/password";
import { signRefreshToken } from "../../utils/jwt";
import {
  register,
  login,
  refreshAccessToken,
  verifyPhone,
  logout,
} from "../auth.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../config/redis", () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  },
}));

jest.mock("../../config/twilio", () => ({
  twilioClient: {
    messages: { create: jest.fn() },
  },
}));

jest.mock("../../utils/password", () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
};
const mockedRedis = redis as unknown as {
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  exists: jest.Mock;
};

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("creates a user and returns tokens when email is not taken", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      (hashPassword as jest.Mock).mockResolvedValue("hashed-pw");
      mockedPrisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "a@b.com",
        phone: undefined,
        passwordHash: "hashed-pw",
        firstName: "Jane",
        lastName: "Doe",
        role: "SENDER",
      });

      const result = await register({
        email: "a@b.com",
        password: "pw123456",
        firstName: "Jane",
        lastName: "Doe",
        role: "SENDER",
      } as any);

      expect(result.user.email).toBe("a@b.com");
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(twilioClient.messages.create).not.toHaveBeenCalled();
    });

    it("sends an OTP via twilio when the user provides a phone number", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      (hashPassword as jest.Mock).mockResolvedValue("hashed-pw");
      mockedPrisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "a@b.com",
        phone: "+15551234567",
        passwordHash: "hashed-pw",
        firstName: "Jane",
        lastName: "Doe",
        role: "SENDER",
      });

      await register({
        email: "a@b.com",
        phone: "+15551234567",
        password: "pw123456",
        firstName: "Jane",
        lastName: "Doe",
        role: "SENDER",
      } as any);

      expect(mockedRedis.set).toHaveBeenCalledWith(
        "otp:phone:user-1",
        expect.any(String),
        "EX",
        600,
      );
      expect(twilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ to: "+15551234567" }),
      );
    });

    it("throws ConflictError when the email is already registered", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        register({
          email: "a@b.com",
          password: "pw123456",
          firstName: "Jane",
          lastName: "Doe",
          role: "SENDER",
        } as any),
      ).rejects.toThrow("Email is already registered");
    });
  });

  describe("login", () => {
    it("returns user and tokens for valid credentials", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@b.com",
        passwordHash: "hashed-pw",
        role: "SENDER",
      });
      (comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await login("a@b.com", "pw123456");

      expect(result.user.id).toBe("user-1");
      expect(result.accessToken).toBeTruthy();
    });

    it("throws UnauthorizedError when the user does not exist", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(login("a@b.com", "pw123456")).rejects.toThrow(
        "Invalid email or password",
      );
    });

    it("throws UnauthorizedError when the password is incorrect", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@b.com",
        passwordHash: "hashed-pw",
        role: "SENDER",
      });
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(login("a@b.com", "wrong")).rejects.toThrow(
        "Invalid email or password",
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("issues a new access token for a valid, non-revoked refresh token", async () => {
      const { token } = signRefreshToken("user-1");
      mockedRedis.exists.mockResolvedValue(0);
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", role: "SENDER" });

      const result = await refreshAccessToken(token);

      expect(result.accessToken).toBeTruthy();
    });

    it("throws UnauthorizedError for a malformed refresh token", async () => {
      await expect(refreshAccessToken("not-a-jwt")).rejects.toThrow(
        "Invalid or expired refresh token",
      );
    });

    it("throws UnauthorizedError when the refresh token has been revoked", async () => {
      const { token } = signRefreshToken("user-1");
      mockedRedis.exists.mockResolvedValue(1);

      await expect(refreshAccessToken(token)).rejects.toThrow(
        "Refresh token has been revoked",
      );
    });

    it("throws UnauthorizedError when the user no longer exists", async () => {
      const { token } = signRefreshToken("user-1");
      mockedRedis.exists.mockResolvedValue(0);
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(refreshAccessToken(token)).rejects.toThrow(
        "User no longer exists",
      );
    });
  });

  describe("verifyPhone", () => {
    it("verifies the phone and clears the otp when valid", async () => {
      mockedRedis.get.mockResolvedValue("123456");
      mockedPrisma.user.update.mockResolvedValue({
        id: "user-1",
        isPhoneVerified: true,
      });

      const result = await verifyPhone("user-1", "123456");

      expect(mockedRedis.del).toHaveBeenCalledWith("otp:phone:user-1");
      expect(result.isPhoneVerified).toBe(true);
    });

    it("throws BadRequestError when the otp does not match", async () => {
      mockedRedis.get.mockResolvedValue("123456");

      await expect(verifyPhone("user-1", "000000")).rejects.toThrow(
        "Invalid or expired verification code",
      );
    });

    it("throws BadRequestError when there is no stored otp", async () => {
      mockedRedis.get.mockResolvedValue(null);

      await expect(verifyPhone("user-1", "123456")).rejects.toThrow(
        "Invalid or expired verification code",
      );
    });
  });

  describe("logout", () => {
    it("revokes the refresh token jti in redis", async () => {
      const { token, jti } = signRefreshToken("user-1");

      await logout(token);

      expect(mockedRedis.set).toHaveBeenCalledWith(
        `revoked:refresh:${jti}`,
        "1",
        "EX",
        expect.any(Number),
      );
    });

    it("does nothing when the refresh token is invalid", async () => {
      await logout("not-a-jwt");

      expect(mockedRedis.set).not.toHaveBeenCalled();
    });
  });
});
