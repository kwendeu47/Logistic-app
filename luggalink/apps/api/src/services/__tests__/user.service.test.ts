import { prisma } from "../../config/prisma";
import { stripe } from "../../config/stripe";
import {
  getUserById,
  updateProfile,
  createKycSession,
  registerDeviceToken,
  handleIdentityVerified,
  handleIdentityRequiresInput,
  toPublicUser,
} from "../user.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userDevice: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../config/stripe", () => ({
  stripe: {
    identity: {
      verificationSessions: { create: jest.fn() },
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
  userDevice: { upsert: jest.Mock };
};

describe("user.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toPublicUser", () => {
    it("strips the password hash from the user", () => {
      const result = toPublicUser({
        id: "user-1",
        passwordHash: "secret",
        email: "a@b.com",
      } as any);

      expect(result).not.toHaveProperty("passwordHash");
      expect(result.email).toBe("a@b.com");
    });
  });

  describe("getUserById", () => {
    it("returns the public user when found", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        passwordHash: "secret",
        email: "a@b.com",
      });

      const result = await getUserById("user-1");

      expect(result.id).toBe("user-1");
      expect(result).not.toHaveProperty("passwordHash");
    });

    it("throws NotFoundError when the user does not exist", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(getUserById("missing")).rejects.toThrow("User not found");
    });
  });

  describe("updateProfile", () => {
    it("updates the user profile and returns the public user", async () => {
      mockedPrisma.user.update.mockResolvedValue({
        id: "user-1",
        passwordHash: "secret",
        firstName: "Jane",
      });

      const result = await updateProfile("user-1", { firstName: "Jane" });

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { firstName: "Jane" },
      });
      expect(result.firstName).toBe("Jane");
    });
  });

  describe("createKycSession", () => {
    it("creates a stripe identity verification session and updates the user", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      (stripe.identity.verificationSessions.create as jest.Mock).mockResolvedValue({
        id: "vs_123",
        client_secret: "secret_abc",
        url: "https://verify.stripe.com/vs_123",
      });
      mockedPrisma.user.update.mockResolvedValue({});

      const result = await createKycSession("user-1");

      expect(result).toEqual({
        clientSecret: "secret_abc",
        url: "https://verify.stripe.com/vs_123",
      });
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          stripeIdentitySessionId: "vs_123",
          kycStatus: "PENDING",
          kycSubmittedAt: expect.any(Date),
        },
      });
    });

    it("defaults url to null when stripe does not return one", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      (stripe.identity.verificationSessions.create as jest.Mock).mockResolvedValue({
        id: "vs_123",
        client_secret: "secret_abc",
      });
      mockedPrisma.user.update.mockResolvedValue({});

      const result = await createKycSession("user-1");

      expect(result.url).toBeNull();
    });

    it("throws NotFoundError when the user does not exist", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createKycSession("missing")).rejects.toThrow("User not found");
    });
  });

  describe("registerDeviceToken", () => {
    it("upserts the device token", async () => {
      mockedPrisma.userDevice.upsert.mockResolvedValue({ id: "device-1" });

      const result = await registerDeviceToken("user-1", {
        expoPushToken: "ExponentPushToken[abc]",
        platform: "ios",
      });

      expect(mockedPrisma.userDevice.upsert).toHaveBeenCalledWith({
        where: { expoPushToken: "ExponentPushToken[abc]" },
        create: {
          userId: "user-1",
          expoPushToken: "ExponentPushToken[abc]",
          platform: "ios",
        },
        update: { userId: "user-1", platform: "ios" },
      });
      expect(result.id).toBe("device-1");
    });
  });

  describe("handleIdentityVerified", () => {
    it("marks the user as id and face verified", async () => {
      await handleIdentityVerified({
        metadata: { userId: "user-1" },
      } as any);

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isIdVerified: true, isFaceVerified: true, kycStatus: "VERIFIED" },
      });
    });

    it("does nothing when there is no userId in metadata", async () => {
      await handleIdentityVerified({ metadata: {} } as any);

      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("handleIdentityRequiresInput", () => {
    it("sets kycStatus to REQUIRES_INPUT", async () => {
      await handleIdentityRequiresInput({
        metadata: { userId: "user-1" },
      } as any);

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { kycStatus: "REQUIRES_INPUT" },
      });
    });

    it("does nothing when there is no userId in metadata", async () => {
      await handleIdentityRequiresInput({ metadata: {} } as any);

      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
