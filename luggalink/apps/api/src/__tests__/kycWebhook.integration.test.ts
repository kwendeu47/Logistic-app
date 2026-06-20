import express from "express";
import request from "supertest";
import { stripeIdentityWebhookRouter } from "../routes/user.routes";
import { stripe } from "../config/stripe";
import { errorHandler } from "../utils/errors";
import * as userService from "../services/user.service";

jest.mock("../config/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

jest.mock("../services/user.service", () => ({
  handleIdentityVerified: jest.fn(),
  handleIdentityRequiresInput: jest.fn(),
}));

function buildApp() {
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use("/webhooks/stripe-identity", stripeIdentityWebhookRouter);
  app.use(errorHandler);
  return app;
}

describe("Stripe identity (KYC) webhook", () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a webhook request without a Stripe signature header", async () => {
    const response = await request(app)
      .post("/webhooks/stripe-identity")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "identity.verification_session.verified" }));

    expect(response.status).toBe(400);
  });

  it("responds immediately and processes a verified session asynchronously", async () => {
    const event = {
      id: "evt_1",
      type: "identity.verification_session.verified",
      data: { object: { id: "vs_1" } },
    };
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);
    (userService.handleIdentityVerified as jest.Mock).mockResolvedValue(undefined);

    const response = await request(app)
      .post("/webhooks/stripe-identity")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "test-signature")
      .send(JSON.stringify({ type: "identity.verification_session.verified" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });

    await new Promise((resolve) => setImmediate(resolve));
    expect(userService.handleIdentityVerified).toHaveBeenCalledWith(event.data.object);
  });

  it("rejects a webhook with an invalid signature", async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await request(app)
      .post("/webhooks/stripe-identity")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "bad-signature")
      .send(JSON.stringify({ type: "identity.verification_session.verified" }));

    expect(response.status).toBe(500);
  });
});
