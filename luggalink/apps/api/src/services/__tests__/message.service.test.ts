import { prisma } from "../../config/prisma";
import { emitToBooking } from "../../config/socket";
import * as notificationService from "../notification.service";
import { createMessage, getMessages } from "../message.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    booking: { findUnique: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock("../../config/socket", () => ({ emitToBooking: jest.fn() }));

jest.mock("../notification.service", () => ({
  sendToUser: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  booking: { findUnique: jest.Mock };
  message: { create: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock };
};

describe("message.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createMessage", () => {
    it("creates a message, emits a socket event, and notifies the recipient", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });
      mockedPrisma.message.create.mockResolvedValue({
        id: "msg-1",
        bookingId: "booking-1",
        senderId: "sender-1",
        body: "hello",
        createdAt: new Date(),
      });

      const result = await createMessage("booking-1", "sender-1", { body: "hello" });

      expect(result.id).toBe("msg-1");
      expect(emitToBooking).toHaveBeenCalledWith(
        "booking-1",
        "new_message",
        expect.objectContaining({ id: "msg-1", body: "hello" }),
      );
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        "traveler-1",
        expect.objectContaining({ title: "New message", body: "hello" }),
      );
    });

    it("truncates long message bodies in the notification", async () => {
      const longBody = "a".repeat(100);
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });
      mockedPrisma.message.create.mockResolvedValue({
        id: "msg-1",
        bookingId: "booking-1",
        senderId: "sender-1",
        body: longBody,
        createdAt: new Date(),
      });

      await createMessage("booking-1", "sender-1", { body: longBody });

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        "traveler-1",
        expect.objectContaining({ body: `${"a".repeat(80)}...` }),
      );
    });

    it("notifies the sender when the message is sent by the traveler", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });
      mockedPrisma.message.create.mockResolvedValue({
        id: "msg-1",
        bookingId: "booking-1",
        senderId: "traveler-1",
        body: "hi",
        createdAt: new Date(),
      });

      await createMessage("booking-1", "traveler-1", { body: "hi" });

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        "sender-1",
        expect.anything(),
      );
    });

    it("throws NotFoundError when the booking does not exist", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        createMessage("missing", "sender-1", { body: "hello" }),
      ).rejects.toThrow("Booking not found");
    });

    it("throws ForbiddenError when the sender is not a participant", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });

      await expect(
        createMessage("booking-1", "stranger-1", { body: "hello" }),
      ).rejects.toThrow("You are not a participant in this booking");
    });
  });

  describe("getMessages", () => {
    it("returns messages without a next cursor when there are fewer than the page size", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });
      mockedPrisma.message.findMany.mockResolvedValue([
        { id: "m1" },
        { id: "m2" },
      ]);
      mockedPrisma.message.updateMany.mockResolvedValue({ count: 0 });

      const result = await getMessages("booking-1", "sender-1");

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
      expect(mockedPrisma.message.updateMany).toHaveBeenCalledWith({
        where: { bookingId: "booking-1", senderId: { not: "sender-1" }, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });

    it("returns a next cursor when there are more than the page size", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });
      const messages = Array.from({ length: 51 }, (_, i) => ({ id: `m${i}` }));
      mockedPrisma.message.findMany.mockResolvedValue(messages);
      mockedPrisma.message.updateMany.mockResolvedValue({ count: 0 });

      const result = await getMessages("booking-1", "sender-1");

      expect(result.items).toHaveLength(50);
      expect(result.nextCursor).toBe("m49");
    });

    it("applies the cursor when provided", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });
      mockedPrisma.message.findMany.mockResolvedValue([]);
      mockedPrisma.message.updateMany.mockResolvedValue({ count: 0 });

      await getMessages("booking-1", "sender-1", "cursor-id");

      expect(mockedPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 1, cursor: { id: "cursor-id" } }),
      );
    });

    it("throws NotFoundError when the booking does not exist", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(getMessages("missing", "sender-1")).rejects.toThrow(
        "Booking not found",
      );
    });

    it("throws ForbiddenError when the user is not a participant", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue({
        id: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
      });

      await expect(getMessages("booking-1", "stranger-1")).rejects.toThrow(
        "You are not a participant in this booking",
      );
    });
  });
});
