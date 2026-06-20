import { stripe } from "../../config/stripe";
import {
  createEscrowPaymentIntent,
  captureEscrowPaymentIntent,
  cancelEscrowPaymentIntent,
  releaseEscrowToTraveler,
} from "../stripe.service";

jest.mock("../../config/stripe", () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn(),
      capture: jest.fn(),
      cancel: jest.fn(),
    },
    transfers: {
      create: jest.fn(),
    },
  },
}));

describe("stripe.service", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("createEscrowPaymentIntent", () => {
    it("creates a payment intent with amount converted to cents and metadata", async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue({ id: "pi_123" });

      const result = await createEscrowPaymentIntent({
        bookingId: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
        amountUsd: 52.5,
        stripeCustomerId: "cus_123",
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        {
          amount: 5250,
          currency: "usd",
          capture_method: "manual",
          customer: "cus_123",
          metadata: {
            bookingId: "booking-1",
            senderId: "sender-1",
            travelerId: "traveler-1",
          },
        },
        { idempotencyKey: "create-pi-booking-1" },
      );
      expect(result).toEqual({ id: "pi_123" });
    });

    it("uses undefined customer when stripeCustomerId is not provided", async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue({ id: "pi_123" });

      await createEscrowPaymentIntent({
        bookingId: "booking-1",
        senderId: "sender-1",
        travelerId: "traveler-1",
        amountUsd: 10,
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: undefined }),
        expect.anything(),
      );
    });

    it("logs and rethrows when stripe fails", async () => {
      const error = new Error("stripe down");
      (stripe.paymentIntents.create as jest.Mock).mockRejectedValue(error);

      await expect(
        createEscrowPaymentIntent({
          bookingId: "booking-1",
          senderId: "sender-1",
          travelerId: "traveler-1",
          amountUsd: 10,
        }),
      ).rejects.toThrow("stripe down");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("captureEscrowPaymentIntent", () => {
    it("captures the payment intent", async () => {
      (stripe.paymentIntents.capture as jest.Mock).mockResolvedValue({ id: "pi_123", status: "succeeded" });

      const result = await captureEscrowPaymentIntent("pi_123", "booking-1");

      expect(stripe.paymentIntents.capture).toHaveBeenCalledWith("pi_123", undefined, {
        idempotencyKey: "capture-pi-booking-1",
      });
      expect(result).toEqual({ id: "pi_123", status: "succeeded" });
    });

    it("logs and rethrows when capture fails", async () => {
      const error = new Error("capture failed");
      (stripe.paymentIntents.capture as jest.Mock).mockRejectedValue(error);

      await expect(captureEscrowPaymentIntent("pi_123", "booking-1")).rejects.toThrow(
        "capture failed",
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("cancelEscrowPaymentIntent", () => {
    it("cancels the payment intent", async () => {
      (stripe.paymentIntents.cancel as jest.Mock).mockResolvedValue({ id: "pi_123", status: "canceled" });

      const result = await cancelEscrowPaymentIntent("pi_123", "booking-1");

      expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith("pi_123", {
        idempotencyKey: "cancel-pi-booking-1",
      });
      expect(result).toEqual({ id: "pi_123", status: "canceled" });
    });

    it("logs and rethrows when cancel fails", async () => {
      const error = new Error("cancel failed");
      (stripe.paymentIntents.cancel as jest.Mock).mockRejectedValue(error);

      await expect(cancelEscrowPaymentIntent("pi_123", "booking-1")).rejects.toThrow(
        "cancel failed",
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("releaseEscrowToTraveler", () => {
    it("creates a transfer to the traveler's connected account", async () => {
      (stripe.transfers.create as jest.Mock).mockResolvedValue({ id: "tr_123" });

      const result = await releaseEscrowToTraveler({
        bookingId: "booking-1",
        travelerStripeAccountId: "acct_123",
        amountUsd: 45,
      });

      expect(stripe.transfers.create).toHaveBeenCalledWith(
        {
          amount: 4500,
          currency: "usd",
          destination: "acct_123",
          transfer_group: "booking-1",
        },
        { idempotencyKey: "release-escrow-booking-1" },
      );
      expect(result).toEqual({ id: "tr_123" });
    });

    it("uses the idempotency key override when provided", async () => {
      (stripe.transfers.create as jest.Mock).mockResolvedValue({ id: "tr_123" });

      await releaseEscrowToTraveler({
        bookingId: "booking-1",
        travelerStripeAccountId: "acct_123",
        amountUsd: 45,
        idempotencyKeyOverride: "custom-key",
      });

      expect(stripe.transfers.create).toHaveBeenCalledWith(
        expect.anything(),
        { idempotencyKey: "custom-key" },
      );
    });

    it("logs and rethrows when transfer creation fails", async () => {
      const error = new Error("transfer failed");
      (stripe.transfers.create as jest.Mock).mockRejectedValue(error);

      await expect(
        releaseEscrowToTraveler({
          bookingId: "booking-1",
          travelerStripeAccountId: "acct_123",
          amountUsd: 45,
        }),
      ).rejects.toThrow("transfer failed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
