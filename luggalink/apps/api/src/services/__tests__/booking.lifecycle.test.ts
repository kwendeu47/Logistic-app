import { prisma } from "../../config/prisma";
import { emitToBooking } from "../../config/socket";
import { logAuditEvent } from "../../utils/audit";
import { uploadToS3 } from "../../utils/s3";
import * as stripeService from "../stripe.service";
import * as notificationService from "../notification.service";
import * as qrService from "../qr.service";
import {
  acceptBooking,
  rejectBooking,
  reportItemPosted,
  confirmPickup,
  confirmDelivery,
  scanQrCheckpoint,
  openDispute,
  getMyBookings,
  getBookingDetail,
  handlePaymentFailed,
  handleTransferFailed,
} from "../booking.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    booking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    trip: { update: jest.fn() },
    itemRequest: { update: jest.fn() },
    handoffLog: { create: jest.fn() },
    dispute: { create: jest.fn() },
    user: { update: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../../config/socket", () => ({ emitToBooking: jest.fn() }));
jest.mock("../../utils/audit", () => ({ logAuditEvent: jest.fn() }));
jest.mock("../../utils/s3", () => ({ uploadToS3: jest.fn() }));
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
jest.mock("../qr.service", () => ({
  generateSealCode: jest.fn(() => "seal-code"),
  validateSealScan: jest.fn(),
}));
jest.mock("../fraud.service", () => ({
  checkNewAccountHighValue: jest.fn(),
  checkBookingVelocity: jest.fn(),
  checkGpsAirportMismatch: jest.fn(),
}));
jest.mock("../stripe.service", () => ({
  createEscrowPaymentIntent: jest.fn(),
  captureEscrowPaymentIntent: jest.fn(),
  cancelEscrowPaymentIntent: jest.fn(),
  releaseEscrowToTraveler: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  booking: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  trip: { update: jest.Mock };
  itemRequest: { update: jest.Mock };
  handoffLog: { create: jest.Mock };
  dispute: { create: jest.Mock };
  user: { update: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
};

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    senderId: "sender-1",
    travelerId: "traveler-1",
    tripId: "trip-1",
    itemRequestId: "item-1",
    status: "PENDING_TRAVELER",
    escrowStatus: "PENDING",
    stripePaymentIntentId: "pi_123",
    qrSealCode: "seal-code",
    totalPriceUsd: 50,
    insuranceFeeUsd: 0,
    travelerPayoutUsd: 45,
    trip: { originIataCode: "JFK", destinationIataCode: "LHR" },
    itemRequest: {
      name: "Laptop",
      description: "desc",
      weightLbs: 5,
      declaredValueUsd: 200,
      category: "ELECTRONICS",
      recipientName: "R",
      recipientAddress: "addr",
      recipientCountry: "UK",
    },
    sender: { id: "sender-1" },
    traveler: { id: "traveler-1", stripeAccountId: "acct_1" },
    ...overrides,
  };
}

describe("booking.service lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === "function") {
        return cb({
          trip: mockedPrisma.trip,
          itemRequest: mockedPrisma.itemRequest,
          booking: mockedPrisma.booking,
          user: mockedPrisma.user,
        });
      }
      return cb;
    });
  });

  describe("acceptBooking", () => {
    it("captures escrow, generates a customs form, and accepts the booking", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking());
      (stripeService.captureEscrowPaymentIntent as jest.Mock).mockResolvedValue({});
      const customsService = require("../customs.service");
      (customsService.generateAndUploadCustomsForm as jest.Mock).mockResolvedValue("https://forms/1.pdf");
      mockedPrisma.trip.update.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", status: "ACCEPTED" });

      const result = await acceptBooking("booking-1", "traveler-1");

      expect(result.status).toBe("ACCEPTED");
      expect(stripeService.captureEscrowPaymentIntent).toHaveBeenCalledWith("pi_123", "booking-1");
      expect(notificationService.sendBookingAccepted).toHaveBeenCalled();
      expect(notificationService.sendPaymentHeld).toHaveBeenCalled();
    });

    it("throws ForbiddenError when caller is not the traveler", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking());

      await expect(acceptBooking("booking-1", "someone-else")).rejects.toThrow(
        "You are not the traveler for this booking",
      );
    });

    it("throws BadRequestError when status is not PENDING_TRAVELER", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));

      await expect(acceptBooking("booking-1", "traveler-1")).rejects.toThrow(
        "Booking is not pending traveler acceptance",
      );
    });

    it("throws BadRequestError when there is no payment intent", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(
        baseBooking({ stripePaymentIntentId: null }),
      );

      await expect(acceptBooking("booking-1", "traveler-1")).rejects.toThrow(
        "Booking has no payment intent",
      );
    });
  });

  describe("rejectBooking", () => {
    it("cancels escrow and rejects the booking", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking());
      (stripeService.cancelEscrowPaymentIntent as jest.Mock).mockResolvedValue({});
      mockedPrisma.itemRequest.update.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", status: "REJECTED" });

      const result = await rejectBooking("booking-1", "traveler-1");

      expect(result.status).toBe("REJECTED");
      expect(notificationService.sendToUser).toHaveBeenCalled();
    });

    it("skips cancelling escrow when there is no payment intent", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(
        baseBooking({ stripePaymentIntentId: null }),
      );
      mockedPrisma.itemRequest.update.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", status: "REJECTED" });

      await rejectBooking("booking-1", "traveler-1");

      expect(stripeService.cancelEscrowPaymentIntent).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError when caller is not the traveler", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking());

      await expect(rejectBooking("booking-1", "stranger")).rejects.toThrow(
        "You are not the traveler for this booking",
      );
    });

    it("throws BadRequestError when status is not PENDING_TRAVELER", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));

      await expect(rejectBooking("booking-1", "traveler-1")).rejects.toThrow(
        "Booking is not pending traveler acceptance",
      );
    });
  });

  describe("reportItemPosted", () => {
    it("creates a handoff log and updates tracking number", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));
      mockedPrisma.handoffLog.create.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", itemPostedAt: new Date() });
      mockedPrisma.itemRequest.update.mockResolvedValue({});

      const result = await reportItemPosted("booking-1", "sender-1", {
        trackingNumber: "TRACK1",
        photoUrls: ["https://x.com/a.png"],
      });

      expect(result.id).toBe("booking-1");
      expect(notificationService.sendItemPosted).toHaveBeenCalledWith("traveler-1", "TRACK1");
    });

    it("throws ForbiddenError when caller is not the sender", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));

      await expect(
        reportItemPosted("booking-1", "stranger", { trackingNumber: "T", photoUrls: ["https://x.com/a.png"] }),
      ).rejects.toThrow("You are not the sender for this booking");
    });

    it("throws BadRequestError when booking is not accepted", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "PENDING_TRAVELER" }));

      await expect(
        reportItemPosted("booking-1", "sender-1", { trackingNumber: "T", photoUrls: ["https://x.com/a.png"] }),
      ).rejects.toThrow("Booking must be accepted before posting the item");
    });
  });

  describe("confirmPickup", () => {
    it("confirms pickup when the qr code matches", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));
      mockedPrisma.handoffLog.create.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", itemPickedUpAt: new Date() });
      mockedPrisma.itemRequest.update.mockResolvedValue({});

      const result = await confirmPickup("booking-1", "traveler-1", {
        photoUrls: ["https://x.com/a.png"],
        scannedQrCode: "seal-code",
      });

      expect(result.id).toBe("booking-1");
      expect(notificationService.sendQrScanned).toHaveBeenCalledWith("sender-1", "TRAVELER_PICKUP");
      expect(emitToBooking).toHaveBeenCalled();
    });

    it("flags the booking and throws when the qr code mismatches", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));

      await expect(
        confirmPickup("booking-1", "traveler-1", {
          photoUrls: ["https://x.com/a.png"],
          scannedQrCode: "wrong-code",
        }),
      ).rejects.toThrow("Scanned QR code does not match the booking seal code");

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "QR_MISMATCH_PICKUP" }),
      );
      expect(notificationService.sendToUser).toHaveBeenCalledTimes(2);
    });

    it("throws ForbiddenError when caller is not the traveler", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));

      await expect(
        confirmPickup("booking-1", "stranger", {
          photoUrls: ["https://x.com/a.png"],
          scannedQrCode: "seal-code",
        }),
      ).rejects.toThrow("You are not the traveler for this booking");
    });

    it("throws BadRequestError when booking is not accepted", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "PENDING_TRAVELER" }));

      await expect(
        confirmPickup("booking-1", "traveler-1", {
          photoUrls: ["https://x.com/a.png"],
          scannedQrCode: "seal-code",
        }),
      ).rejects.toThrow("Booking must be accepted before confirming pickup");
    });
  });

  describe("confirmDelivery", () => {
    it("releases escrow and completes the booking when qr code matches", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));
      (uploadToS3 as jest.Mock).mockResolvedValue("https://x.com/sig.png");
      mockedPrisma.handoffLog.create.mockResolvedValue({});
      (stripeService.releaseEscrowToTraveler as jest.Mock).mockResolvedValue({ id: "tr_1" });
      mockedPrisma.itemRequest.update.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", status: "COMPLETED" });

      const result = await confirmDelivery("booking-1", "traveler-1", {
        photoUrls: ["https://x.com/a.png"],
        scannedQrCode: "seal-code",
        recipientSignature: "c2lnbmF0dXJl",
      });

      expect(result.status).toBe("COMPLETED");
      expect(notificationService.sendDeliveryConfirmed).toHaveBeenCalled();
      expect(notificationService.sendPayoutSent).toHaveBeenCalled();
    });

    it("throws when the booking status disallows delivery confirmation", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "PENDING_TRAVELER" }));

      await expect(
        confirmDelivery("booking-1", "traveler-1", {
          photoUrls: ["https://x.com/a.png"],
          scannedQrCode: "seal-code",
          recipientSignature: "sig",
        }),
      ).rejects.toThrow("Booking is not in a state that allows delivery confirmation");
    });

    it("flags the booking and throws when the qr code mismatches", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACTIVE" }));

      await expect(
        confirmDelivery("booking-1", "traveler-1", {
          photoUrls: ["https://x.com/a.png"],
          scannedQrCode: "wrong",
          recipientSignature: "sig",
        }),
      ).rejects.toThrow("Scanned QR code does not match the booking seal code");
    });

    it("throws when the traveler has no connected stripe account", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(
        baseBooking({ status: "ACCEPTED", traveler: { id: "traveler-1", stripeAccountId: null } }),
      );
      (uploadToS3 as jest.Mock).mockResolvedValue("https://x.com/sig.png");
      mockedPrisma.handoffLog.create.mockResolvedValue({});

      await expect(
        confirmDelivery("booking-1", "traveler-1", {
          photoUrls: ["https://x.com/a.png"],
          scannedQrCode: "seal-code",
          recipientSignature: "sig",
        }),
      ).rejects.toThrow("Traveler has no connected Stripe account for payout");
    });
  });

  describe("scanQrCheckpoint", () => {
    it("transitions booking to ACTIVE on departure scan", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));
      (qrService.validateSealScan as jest.Mock).mockReturnValue(true);
      mockedPrisma.handoffLog.create.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", status: "ACTIVE" });

      const result = await scanQrCheckpoint("booking-1", "sender-1", {
        scannedCode: "seal-code",
        stage: "QR_SCAN_DEPARTURE",
        photoUrls: ["https://x.com/a.png"],
      });

      expect(result.status).toBe("ACTIVE");
      expect(notificationService.sendQrScanned).toHaveBeenCalledWith("traveler-1", "QR_SCAN_DEPARTURE");
    });

    it("releases escrow and completes on arrival scan", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACTIVE" }));
      (qrService.validateSealScan as jest.Mock).mockReturnValue(true);
      mockedPrisma.handoffLog.create.mockResolvedValue({});
      (stripeService.releaseEscrowToTraveler as jest.Mock).mockResolvedValue({ id: "tr_1" });
      mockedPrisma.itemRequest.update.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});
      mockedPrisma.booking.update.mockResolvedValue({ id: "booking-1", status: "COMPLETED" });

      const result = await scanQrCheckpoint("booking-1", "traveler-1", {
        scannedCode: "seal-code",
        stage: "QR_SCAN_ARRIVAL",
        photoUrls: ["https://x.com/a.png"],
      });

      expect(result.status).toBe("COMPLETED");
      expect(notificationService.sendQrScanned).toHaveBeenCalledWith("sender-1", "QR_SCAN_ARRIVAL");
    });

    it("throws ForbiddenError when caller is not a party to the booking", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));

      await expect(
        scanQrCheckpoint("booking-1", "stranger", {
          scannedCode: "seal-code",
          stage: "QR_SCAN_DEPARTURE",
          photoUrls: ["https://x.com/a.png"],
        }),
      ).rejects.toThrow("You are not a party to this booking");
    });

    it("throws BadRequestError when the qr code is invalid", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ status: "ACCEPTED" }));
      (qrService.validateSealScan as jest.Mock).mockReturnValue(false);

      await expect(
        scanQrCheckpoint("booking-1", "sender-1", {
          scannedCode: "wrong-code",
          stage: "QR_SCAN_DEPARTURE",
          photoUrls: ["https://x.com/a.png"],
        }),
      ).rejects.toThrow("Scanned QR code is invalid or does not match the booking seal code");
    });
  });

  describe("openDispute", () => {
    it("opens a dispute and freezes escrow when held", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ escrowStatus: "HELD" }));
      mockedPrisma.dispute.create.mockResolvedValue({ id: "dispute-1" });
      mockedPrisma.booking.update.mockResolvedValue({});

      const result = await openDispute("booking-1", "sender-1", {
        reason: "ITEM_DAMAGED",
        description: "It broke",
        evidenceUrls: [],
      });

      expect(result.id).toBe("dispute-1");
      expect(mockedPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: "booking-1" },
        data: { status: "DISPUTED", escrowStatus: "FROZEN" },
      });
      expect(notificationService.sendDisputeOpened).toHaveBeenCalledTimes(2);
    });

    it("does not change escrowStatus when not held", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking({ escrowStatus: "RELEASED" }));
      mockedPrisma.dispute.create.mockResolvedValue({ id: "dispute-1" });
      mockedPrisma.booking.update.mockResolvedValue({});

      await openDispute("booking-1", "traveler-1", {
        reason: "OTHER",
        description: "issue",
        evidenceUrls: [],
      });

      expect(mockedPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: "booking-1" },
        data: { status: "DISPUTED" },
      });
    });

    it("throws ForbiddenError when caller is not a party to the booking", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking());

      await expect(
        openDispute("booking-1", "stranger", {
          reason: "OTHER",
          description: "issue",
          evidenceUrls: [],
        }),
      ).rejects.toThrow("You are not a party to this booking");
    });
  });

  describe("getMyBookings", () => {
    it("queries bookings where the user is sender or traveler", async () => {
      mockedPrisma.booking.findMany.mockResolvedValue([{ id: "booking-1" }]);

      const result = await getMyBookings("sender-1");

      expect(mockedPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ senderId: "sender-1" }, { travelerId: "sender-1" }] },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getBookingDetail", () => {
    it("returns the booking detail", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(baseBooking());

      const result = await getBookingDetail("booking-1");

      expect(result.id).toBe("booking-1");
    });

    it("throws NotFoundError when the booking does not exist", async () => {
      mockedPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(getBookingDetail("missing")).rejects.toThrow("Booking not found");
    });
  });

  describe("handlePaymentFailed", () => {
    it("cancels the booking and notifies the sender", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue(baseBooking());
      mockedPrisma.booking.update.mockResolvedValue({});
      mockedPrisma.itemRequest.update.mockResolvedValue({});

      await handlePaymentFailed("pi_123");

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        "sender-1",
        expect.objectContaining({ title: "Payment failed" }),
      );
    });

    it("does nothing when no booking matches the payment intent", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue(null);

      await handlePaymentFailed("missing-pi");

      expect(notificationService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe("handleTransferFailed", () => {
    it("retries the transfer successfully", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue(baseBooking());
      (stripeService.releaseEscrowToTraveler as jest.Mock).mockResolvedValue({ id: "tr_retry" });
      mockedPrisma.booking.update.mockResolvedValue({});

      await handleTransferFailed("tr_failed");

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "TRANSFER_RETRY_SUCCEEDED" }),
      );
    });

    it("notifies an admin when the retry also fails", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue(baseBooking());
      (stripeService.releaseEscrowToTraveler as jest.Mock).mockRejectedValue(new Error("still failing"));
      mockedPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      await handleTransferFailed("tr_failed");

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "TRANSFER_RETRY_FAILED" }),
      );
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        "admin-1",
        expect.objectContaining({ title: "Payout retry failed" }),
      );
      consoleErrorSpy.mockRestore();
    });

    it("does nothing when no booking matches the transfer", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue(null);

      await handleTransferFailed("missing-tr");

      expect(stripeService.releaseEscrowToTraveler).not.toHaveBeenCalled();
    });

    it("does nothing when the traveler has no connected stripe account", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue(
        baseBooking({ traveler: { id: "traveler-1", stripeAccountId: null } }),
      );

      await handleTransferFailed("tr_failed");

      expect(stripeService.releaseEscrowToTraveler).not.toHaveBeenCalled();
    });
  });
});
