import { prisma } from "../../config/prisma";
import * as stripeService from "../stripe.service";
import * as fraudService from "../fraud.service";
import { createBooking } from "../booking.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    trip: { findUnique: jest.fn(), update: jest.fn() },
    itemRequest: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    booking: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock("../../config/socket", () => ({ emitToBooking: jest.fn() }));
jest.mock("../../utils/audit", () => ({ logAuditEvent: jest.fn() }));
jest.mock("../customs.service", () => ({ generateAndUploadCustomsForm: jest.fn() }));
jest.mock("../notification.service", () => ({
  sendBookingRequest: jest.fn(),
  sendBookingAccepted: jest.fn(),
  sendPaymentHeld: jest.fn(),
  sendToUser: jest.fn(),
  sendItemPosted: jest.fn(),
  sendQrScanned: jest.fn(),
  sendDeliveryConfirmed: jest.fn(),
  sendPayoutSent: jest.fn(),
  sendDisputeOpened: jest.fn(),
}));
jest.mock("../qr.service", () => ({ generateSealCode: jest.fn(() => "seal-code") }));
jest.mock("../fraud.service", () => ({
  checkNewAccountHighValue: jest.fn(),
  checkBookingVelocity: jest.fn(),
  checkGpsAirportMismatch: jest.fn(),
}));
jest.mock("../stripe.service", () => ({
  createEscrowPaymentIntent: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  trip: { findUnique: jest.Mock; update: jest.Mock };
  itemRequest: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock };
  booking: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe("createBooking escrow calculations", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      travelerId: "traveler-1",
      status: "ACTIVE",
      availableLbs: 50,
      pricePerLb: 10,
      allowedCategories: ["ELECTRONICS"],
    });

    mockedPrisma.itemRequest.findUnique.mockResolvedValue({
      id: "item-1",
      senderId: "sender-1",
      weightLbs: 5,
      category: "ELECTRONICS",
      declaredValueUsd: 200,
    });

    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "sender-1",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      stripeCustomerId: "cus_123",
    });

    let bookingState: Record<string, unknown> = {};
    mockedPrisma.booking.create.mockImplementation(({ data }) => {
      bookingState = { ...data };
      return Promise.resolve(bookingState);
    });
    mockedPrisma.booking.update.mockImplementation(({ data }) => {
      bookingState = { ...bookingState, ...data };
      return Promise.resolve(bookingState);
    });
    mockedPrisma.itemRequest.update.mockResolvedValue({});

    (stripeService.createEscrowPaymentIntent as jest.Mock).mockResolvedValue({
      id: "pi_123",
      client_secret: "secret_123",
    });

    (fraudService.checkNewAccountHighValue as jest.Mock).mockResolvedValue(false);
    (fraudService.checkBookingVelocity as jest.Mock).mockResolvedValue(false);
  });

  it("computes platform fee, traveler payout, and total price from weight and price per lb", async () => {
    const result = await createBooking("sender-1", {
      itemRequestId: "item-1",
      tripId: "trip-1",
      hasInsurance: false,
    });

    expect(result.booking.totalPriceUsd).toBe(50);
    expect(result.booking.platformFeeUsd).toBe(5);
    expect(result.booking.travelerPayoutUsd).toBe(45);
    expect(result.booking.insuranceFeeUsd).toBe(0);
  });

  it("adds the flat insurance fee when insurance is requested", async () => {
    const result = await createBooking("sender-1", {
      itemRequestId: "item-1",
      tripId: "trip-1",
      hasInsurance: true,
    });

    expect(result.booking.insuranceFeeUsd).toBe(2.0);
    expect(stripeService.createEscrowPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountUsd: 52 }),
    );
  });

  it("rejects when the trip does not have enough capacity", async () => {
    mockedPrisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      travelerId: "traveler-1",
      status: "ACTIVE",
      availableLbs: 1,
      pricePerLb: 10,
      allowedCategories: ["ELECTRONICS"],
    });

    await expect(
      createBooking("sender-1", { itemRequestId: "item-1", tripId: "trip-1", hasInsurance: false }),
    ).rejects.toThrow("Trip does not have enough available capacity");
  });

  it("rejects when the item category is not allowed on the trip", async () => {
    mockedPrisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      travelerId: "traveler-1",
      status: "ACTIVE",
      availableLbs: 50,
      pricePerLb: 10,
      allowedCategories: ["DOCUMENTS"],
    });

    await expect(
      createBooking("sender-1", { itemRequestId: "item-1", tripId: "trip-1", hasInsurance: false }),
    ).rejects.toThrow("Item category is not allowed on this trip");
  });

  it("invokes the fraud checks for the new booking", async () => {
    await createBooking("sender-1", { itemRequestId: "item-1", tripId: "trip-1", hasInsurance: false });

    expect(fraudService.checkNewAccountHighValue).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: "sender-1", declaredValueUsd: 200 }),
    );
    expect(fraudService.checkBookingVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: "sender-1" }),
    );
  });
});
