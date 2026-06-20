import { prisma } from "../../config/prisma";
import { sendEmail } from "../../utils/email";
import {
  checkBookingVelocity,
  checkGpsAirportMismatch,
  checkNewAccountHighValue,
  checkTravelerDestinationSpray,
} from "../fraud.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    fraudAlert: { create: jest.fn() },
    user: { findMany: jest.fn() },
    booking: { count: jest.fn() },
    trip: { findMany: jest.fn() },
  },
}));

jest.mock("../../utils/email", () => ({
  sendEmail: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  fraudAlert: { create: jest.Mock };
  user: { findMany: jest.Mock };
  booking: { count: jest.Mock };
  trip: { findMany: jest.Mock };
};

describe("fraud.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.fraudAlert.create.mockResolvedValue({ id: "alert-1" });
    mockedPrisma.user.findMany.mockResolvedValue([{ id: "admin-1", email: "admin@luggalink.app" }]);
  });

  describe("checkNewAccountHighValue", () => {
    it("flags a new account booking a high-value item", async () => {
      const flagged = await checkNewAccountHighValue({
        bookingId: "booking-1",
        senderId: "sender-1",
        senderCreatedAt: new Date(Date.now() - 1000 * 60 * 60),
        declaredValueUsd: 1000,
      });

      expect(flagged).toBe(true);
      expect(mockedPrisma.fraudAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reason: "NEW_ACCOUNT_HIGH_VALUE" }) }),
      );
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("does not flag an old account with a high-value item", async () => {
      const flagged = await checkNewAccountHighValue({
        bookingId: "booking-1",
        senderId: "sender-1",
        senderCreatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        declaredValueUsd: 1000,
      });

      expect(flagged).toBe(false);
      expect(mockedPrisma.fraudAlert.create).not.toHaveBeenCalled();
    });

    it("does not flag a new account with a low-value item", async () => {
      const flagged = await checkNewAccountHighValue({
        bookingId: "booking-1",
        senderId: "sender-1",
        senderCreatedAt: new Date(),
        declaredValueUsd: 100,
      });

      expect(flagged).toBe(false);
    });
  });

  describe("checkBookingVelocity", () => {
    it("flags a sender exceeding the velocity threshold", async () => {
      mockedPrisma.booking.count.mockResolvedValue(4);

      const flagged = await checkBookingVelocity({ senderId: "sender-1", bookingId: "booking-1" });

      expect(flagged).toBe(true);
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("does not flag a sender within the velocity threshold", async () => {
      mockedPrisma.booking.count.mockResolvedValue(2);

      const flagged = await checkBookingVelocity({ senderId: "sender-1", bookingId: "booking-1" });

      expect(flagged).toBe(false);
      expect(mockedPrisma.fraudAlert.create).not.toHaveBeenCalled();
    });
  });

  describe("checkTravelerDestinationSpray", () => {
    it("flags a traveler with 3+ distinct destinations in the window", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([
        { destinationCountry: "Kenya" },
        { destinationCountry: "Nigeria" },
        { destinationCountry: "Ghana" },
      ]);

      const flagged = await checkTravelerDestinationSpray({ travelerId: "traveler-1" });

      expect(flagged).toBe(true);
    });

    it("does not flag a traveler with fewer than 3 distinct destinations", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([
        { destinationCountry: "Kenya" },
        { destinationCountry: "Kenya" },
      ]);

      const flagged = await checkTravelerDestinationSpray({ travelerId: "traveler-1" });

      expect(flagged).toBe(false);
    });
  });

  describe("checkGpsAirportMismatch", () => {
    it("returns false when no coordinates are provided", async () => {
      const flagged = await checkGpsAirportMismatch({
        bookingId: "booking-1",
        performedByUserId: "user-1",
        expectedIataCode: "JFK",
      });

      expect(flagged).toBe(false);
      expect(mockedPrisma.fraudAlert.create).not.toHaveBeenCalled();
    });

    it("returns false for an unknown airport code", async () => {
      const flagged = await checkGpsAirportMismatch({
        bookingId: "booking-1",
        performedByUserId: "user-1",
        expectedIataCode: "ZZZ",
        latitude: 0,
        longitude: 0,
      });

      expect(flagged).toBe(false);
    });

    it("flags a scan far from the expected airport", async () => {
      const flagged = await checkGpsAirportMismatch({
        bookingId: "booking-1",
        performedByUserId: "user-1",
        expectedIataCode: "JFK",
        latitude: -1.3192,
        longitude: 36.9278,
      });

      expect(flagged).toBe(true);
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("does not flag a scan near the expected airport", async () => {
      const flagged = await checkGpsAirportMismatch({
        bookingId: "booking-1",
        performedByUserId: "user-1",
        expectedIataCode: "JFK",
        latitude: 40.645,
        longitude: -73.78,
      });

      expect(flagged).toBe(false);
    });
  });
});
