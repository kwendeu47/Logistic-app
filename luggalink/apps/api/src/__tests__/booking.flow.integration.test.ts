import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { bookingRouter } from "../routes/booking.routes";
import { errorHandler } from "../utils/errors";
import * as bookingService from "../services/booking.service";

jest.mock("../services/booking.service", () => {
  const actual = jest.requireActual("../services/booking.service");
  return {
    ...actual,
    createBooking: jest.fn(),
    acceptBooking: jest.fn(),
    rejectBooking: jest.fn(),
    reportItemPosted: jest.fn(),
    confirmPickup: jest.fn(),
    confirmDelivery: jest.fn(),
    openDispute: jest.fn(),
    getBookingDetail: jest.fn(),
    getMyBookings: jest.fn(),
  };
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/bookings", bookingRouter);
  app.use(errorHandler);
  return app;
}

function tokenFor(userId: string, role = "SENDER"): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!);
}

describe("booking flow integration", () => {
  const app = buildApp();
  const senderId = "sender-1";
  const travelerId = "traveler-1";
  const bookingId = "booking-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects requests without an access token", async () => {
    const response = await request(app).post("/bookings").send({});

    expect(response.status).toBe(401);
  });

  it("rejects booking creation with an invalid payload", async () => {
    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${tokenFor(senderId)}`)
      .send({ itemRequestId: "not-a-uuid" });

    expect(response.status).toBe(422);
  });

  it("walks a booking through request -> accept -> post -> pickup -> deliver", async () => {
    (bookingService.createBooking as jest.Mock).mockResolvedValue({
      booking: { id: bookingId, status: "PENDING_TRAVELER" },
      stripeClientSecret: "secret_123",
    });

    const createResponse = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${tokenFor(senderId)}`)
      .send({
        itemRequestId: "11111111-1111-1111-1111-111111111111",
        tripId: "22222222-2222-2222-2222-222222222222",
        hasInsurance: false,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.booking.status).toBe("PENDING_TRAVELER");

    (bookingService.acceptBooking as jest.Mock).mockResolvedValue({ id: bookingId, status: "ACCEPTED" });

    const acceptResponse = await request(app)
      .post(`/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${tokenFor(travelerId)}`);

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.booking.status).toBe("ACCEPTED");

    (bookingService.reportItemPosted as jest.Mock).mockResolvedValue({ id: bookingId, status: "ACCEPTED" });

    const postedResponse = await request(app)
      .post(`/bookings/${bookingId}/item-posted`)
      .set("Authorization", `Bearer ${tokenFor(senderId)}`)
      .send({ trackingNumber: "TRACK123", photoUrls: ["https://example.com/photo.jpg"] });

    expect(postedResponse.status).toBe(200);

    (bookingService.confirmPickup as jest.Mock).mockResolvedValue({ id: bookingId, status: "ACCEPTED" });

    const pickupResponse = await request(app)
      .post(`/bookings/${bookingId}/pickup-confirmed`)
      .set("Authorization", `Bearer ${tokenFor(travelerId)}`)
      .send({ photoUrls: ["https://example.com/pickup.jpg"], scannedQrCode: "seal-code" });

    expect(pickupResponse.status).toBe(200);

    (bookingService.confirmDelivery as jest.Mock).mockResolvedValue({ id: bookingId, status: "COMPLETED" });

    const deliveryResponse = await request(app)
      .post(`/bookings/${bookingId}/delivery-confirmed`)
      .set("Authorization", `Bearer ${tokenFor(travelerId)}`)
      .send({
        photoUrls: ["https://example.com/delivery.jpg"],
        scannedQrCode: "seal-code",
        recipientSignature: "c2lnbmF0dXJl",
      });

    expect(deliveryResponse.status).toBe(200);
    expect(deliveryResponse.body.booking.status).toBe("COMPLETED");
  });

  it("opens a dispute on a booking", async () => {
    (bookingService.openDispute as jest.Mock).mockResolvedValue({ id: "dispute-1", status: "OPEN" });

    const response = await request(app)
      .post(`/bookings/${bookingId}/dispute`)
      .set("Authorization", `Bearer ${tokenFor(senderId)}`)
      .send({ reason: "ITEM_NOT_RECEIVED", description: "Never arrived", evidenceUrls: [] });

    expect(response.status).toBe(201);
    expect(response.body.dispute.status).toBe("OPEN");
  });

  it("surfaces booking service errors with the correct status code", async () => {
    (bookingService.acceptBooking as jest.Mock).mockRejectedValue(
      new (jest.requireActual("../utils/errors").BadRequestError)("Booking is not pending traveler acceptance"),
    );

    const response = await request(app)
      .post(`/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${tokenFor(travelerId)}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Booking is not pending traveler acceptance");
  });
});
