import { prisma } from "../../config/prisma";
import { isUserOnline } from "../../config/socket";
import {
  sendToUser,
  sendBookingRequest,
  sendBookingAccepted,
  sendPaymentHeld,
  sendItemPosted,
  sendQrScanned,
  sendDeliveryConfirmed,
  sendDisputeOpened,
  sendPayoutSent,
} from "../notification.service";

jest.mock("expo-server-sdk", () => {
  const mockChunkPushNotifications = jest.fn();
  const mockSendPushNotificationsAsync = jest.fn();
  const mockIsExpoPushToken = jest.fn();
  const ExpoMock = jest.fn().mockImplementation(() => ({
    chunkPushNotifications: mockChunkPushNotifications,
    sendPushNotificationsAsync: mockSendPushNotificationsAsync,
  }));
  (ExpoMock as unknown as { isExpoPushToken: jest.Mock }).isExpoPushToken = mockIsExpoPushToken;
  return {
    Expo: ExpoMock,
    __mocks__: { mockChunkPushNotifications, mockSendPushNotificationsAsync, mockIsExpoPushToken },
  };
});

const { mockChunkPushNotifications, mockSendPushNotificationsAsync, mockIsExpoPushToken } = (
  jest.requireMock("expo-server-sdk") as {
    __mocks__: {
      mockChunkPushNotifications: jest.Mock;
      mockSendPushNotificationsAsync: jest.Mock;
      mockIsExpoPushToken: jest.Mock;
    };
  }
).__mocks__;

jest.mock("../../config/prisma", () => ({
  prisma: {
    notification: { create: jest.fn() },
    userDevice: { findMany: jest.fn(), deleteMany: jest.fn() },
  },
}));

jest.mock("../../config/socket", () => ({ isUserOnline: jest.fn() }));

const mockedPrisma = prisma as unknown as {
  notification: { create: jest.Mock };
  userDevice: { findMany: jest.Mock; deleteMany: jest.Mock };
};

describe("notification.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.notification.create.mockResolvedValue({});
    mockIsExpoPushToken.mockReturnValue(true);
  });

  describe("sendToUser", () => {
    it("creates a notification record and skips push when the user is online", async () => {
      (isUserOnline as jest.Mock).mockReturnValue(true);

      await sendToUser("user-1", { title: "Hi", body: "Hello" });

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: { userId: "user-1", type: "GENERAL", title: "Hi", body: "Hello" },
      });
      expect(mockedPrisma.userDevice.findMany).not.toHaveBeenCalled();
    });

    it("includes data in the notification payload when provided", async () => {
      (isUserOnline as jest.Mock).mockReturnValue(true);

      await sendToUser("user-1", { title: "Hi", body: "Hello", data: { bookingId: "b1" } });

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "GENERAL",
          title: "Hi",
          body: "Hello",
          data: { bookingId: "b1" },
        },
      });
    });

    it("sends a push notification when the user is offline and has devices", async () => {
      (isUserOnline as jest.Mock).mockReturnValue(false);
      mockedPrisma.userDevice.findMany.mockResolvedValue([
        { expoPushToken: "ExponentPushToken[abc]" },
      ]);
      mockChunkPushNotifications.mockReturnValue([
        [{ to: "ExponentPushToken[abc]", title: "Hi", body: "Hello" }],
      ]);
      mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok" }]);

      await sendToUser("user-1", { title: "Hi", body: "Hello" });

      expect(mockSendPushNotificationsAsync).toHaveBeenCalled();
      expect(mockedPrisma.userDevice.deleteMany).not.toHaveBeenCalled();
    });

    it("does nothing when the user is offline but has no devices", async () => {
      (isUserOnline as jest.Mock).mockReturnValue(false);
      mockedPrisma.userDevice.findMany.mockResolvedValue([]);

      await sendToUser("user-1", { title: "Hi", body: "Hello" });

      expect(mockChunkPushNotifications).not.toHaveBeenCalled();
    });

    it("filters out devices with invalid expo push tokens", async () => {
      (isUserOnline as jest.Mock).mockReturnValue(false);
      mockedPrisma.userDevice.findMany.mockResolvedValue([
        { expoPushToken: "invalid-token" },
      ]);
      mockIsExpoPushToken.mockReturnValue(false);
      mockChunkPushNotifications.mockReturnValue([]);

      await sendToUser("user-1", { title: "Hi", body: "Hello" });

      expect(mockChunkPushNotifications).toHaveBeenCalledWith([]);
    });

    it("removes stale device tokens that returned DeviceNotRegistered errors", async () => {
      (isUserOnline as jest.Mock).mockReturnValue(false);
      mockedPrisma.userDevice.findMany.mockResolvedValue([
        { expoPushToken: "ExponentPushToken[abc]" },
      ]);
      const chunk = [{ to: "ExponentPushToken[abc]", title: "Hi", body: "Hello" }];
      mockChunkPushNotifications.mockReturnValue([chunk]);
      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: "error", details: { error: "DeviceNotRegistered" } },
      ]);

      await sendToUser("user-1", { title: "Hi", body: "Hello" });

      expect(mockedPrisma.userDevice.deleteMany).toHaveBeenCalledWith({
        where: { expoPushToken: { in: ["ExponentPushToken[abc]"] } },
      });
    });

    it("logs an error and continues when sending a push batch fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      (isUserOnline as jest.Mock).mockReturnValue(false);
      mockedPrisma.userDevice.findMany.mockResolvedValue([
        { expoPushToken: "ExponentPushToken[abc]" },
      ]);
      mockChunkPushNotifications.mockReturnValue([
        [{ to: "ExponentPushToken[abc]", title: "Hi", body: "Hello" }],
      ]);
      mockSendPushNotificationsAsync.mockRejectedValue(new Error("network error"));

      await sendToUser("user-1", { title: "Hi", body: "Hello" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("typed dispatch helpers", () => {
    beforeEach(() => {
      (isUserOnline as jest.Mock).mockReturnValue(true);
    });

    it("sendBookingRequest dispatches a BOOKING_REQUEST notification", async () => {
      await sendBookingRequest("traveler-1", { id: "b1", totalPriceUsd: 50 } as any);

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "traveler-1", type: "BOOKING_REQUEST" }),
      });
    });

    it("sendBookingAccepted dispatches a BOOKING_ACCEPTED notification", async () => {
      await sendBookingAccepted("sender-1", { id: "b1" } as any);

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "sender-1", type: "BOOKING_ACCEPTED" }),
      });
    });

    it("sendPaymentHeld dispatches a PAYMENT_HELD notification", async () => {
      await sendPaymentHeld("sender-1", 99.5);

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "sender-1", type: "PAYMENT_HELD" }),
      });
    });

    it("sendItemPosted dispatches an ITEM_POSTED notification", async () => {
      await sendItemPosted("traveler-1", "TRACK123");

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "traveler-1", type: "ITEM_POSTED" }),
      });
    });

    it("sendQrScanned dispatches a QR_SCANNED notification", async () => {
      await sendQrScanned("sender-1", "pickup");

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "sender-1", type: "QR_SCANNED" }),
      });
    });

    it("sendDeliveryConfirmed dispatches a DELIVERED notification", async () => {
      await sendDeliveryConfirmed("traveler-1", 45);

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "traveler-1", type: "DELIVERED" }),
      });
    });

    it("sendDisputeOpened dispatches a DISPUTE_OPENED notification", async () => {
      await sendDisputeOpened("user-1", "dispute-1");

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-1", type: "DISPUTE_OPENED" }),
      });
    });

    it("sendPayoutSent dispatches a PAYOUT_SENT notification", async () => {
      await sendPayoutSent("traveler-1", 100);

      expect(mockedPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "traveler-1", type: "PAYOUT_SENT" }),
      });
    });
  });
});
