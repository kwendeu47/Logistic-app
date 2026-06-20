import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import type { Booking, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { isUserOnline } from "../config/socket";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export interface SendToUserInput {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function dispatch(userId: string, type: NotificationType, input: SendToUserInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title: input.title,
      body: input.body,
      ...(input.data ? { data: input.data as Prisma.InputJsonValue } : {}),
    },
  });

  if (!isUserOnline(userId)) {
    await sendPushToDevices(userId, input);
  }
}

async function sendPushToDevices(userId: string, input: SendToUserInput): Promise<void> {
  const devices = await prisma.userDevice.findMany({ where: { userId } });
  if (devices.length === 0) {
    return;
  }

  const messages: ExpoPushMessage[] = devices
    .filter((device) => Expo.isExpoPushToken(device.expoPushToken))
    .map((device) => ({
      to: device.expoPushToken,
      title: input.title,
      body: input.body,
      data: input.data,
    }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      await removeStaleTokens(chunk, tickets);
    } catch (error) {
      console.error("Failed to send push notification batch", error);
    }
  }
}

async function removeStaleTokens(chunk: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<void> {
  const staleTokens = tickets
    .map((ticket, index) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const message = chunk[index];
        return typeof message?.to === "string" ? message.to : undefined;
      }
      return undefined;
    })
    .filter((token): token is string => Boolean(token));

  if (staleTokens.length > 0) {
    await prisma.userDevice.deleteMany({ where: { expoPushToken: { in: staleTokens } } });
  }
}

export async function sendToUser(userId: string, input: SendToUserInput): Promise<void> {
  await dispatch(userId, "GENERAL", input);
}

export async function sendBookingRequest(travelerId: string, booking: Booking): Promise<void> {
  await dispatch(travelerId, "BOOKING_REQUEST", {
    title: "New booking request",
    body: `You have a new booking request worth $${booking.totalPriceUsd.toFixed(2)}.`,
    data: { bookingId: booking.id },
  });
}

export async function sendBookingAccepted(senderId: string, booking: Booking): Promise<void> {
  await dispatch(senderId, "BOOKING_ACCEPTED", {
    title: "Booking accepted",
    body: "Your traveler accepted the booking.",
    data: { bookingId: booking.id },
  });
}

export async function sendPaymentHeld(senderId: string, amount: number): Promise<void> {
  await dispatch(senderId, "PAYMENT_HELD", {
    title: "Payment held in escrow",
    body: `$${amount.toFixed(2)} is now held in escrow until delivery is confirmed.`,
  });
}

export async function sendItemPosted(travelerId: string, trackingNumber: string): Promise<void> {
  await dispatch(travelerId, "ITEM_POSTED", {
    title: "Item posted",
    body: `The sender posted the item. Tracking number: ${trackingNumber}.`,
    data: { trackingNumber },
  });
}

export async function sendQrScanned(senderId: string, stage: string): Promise<void> {
  await dispatch(senderId, "QR_SCANNED", {
    title: "QR code scanned",
    body: `The booking QR seal was scanned at stage: ${stage}.`,
    data: { stage },
  });
}

export async function sendDeliveryConfirmed(travelerId: string, payout: number): Promise<void> {
  await dispatch(travelerId, "DELIVERED", {
    title: "Delivery confirmed",
    body: `Delivery confirmed. Your payout of $${payout.toFixed(2)} is being processed.`,
    data: { payout },
  });
}

export async function sendDisputeOpened(userId: string, disputeId: string): Promise<void> {
  await dispatch(userId, "DISPUTE_OPENED", {
    title: "Dispute opened",
    body: "A dispute has been opened on your booking. Escrow funds are frozen pending review.",
    data: { disputeId },
  });
}

export async function sendPayoutSent(travelerId: string, amount: number): Promise<void> {
  await dispatch(travelerId, "PAYOUT_SENT", {
    title: "Payout sent",
    body: `Your payout of $${amount.toFixed(2)} has been sent.`,
    data: { amount },
  });
}
