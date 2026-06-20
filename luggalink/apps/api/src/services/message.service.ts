import type { Message } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { emitToBooking } from "../config/socket";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import * as notificationService from "./notification.service";

const MESSAGE_MAX_LENGTH = 1000;
const MESSAGES_PAGE_SIZE = 50;

export const createMessageSchema = z.object({
  body: z.string().min(1).max(MESSAGE_MAX_LENGTH),
});

export const listMessagesSchema = z.object({
  cursor: z.string().uuid().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesSchema>;

async function getBookingParticipants(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, senderId: true, travelerId: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

function assertParticipant(booking: { senderId: string; travelerId: string }, userId: string): void {
  if (booking.senderId !== userId && booking.travelerId !== userId) {
    throw new ForbiddenError("You are not a participant in this booking");
  }
}

export async function createMessage(
  bookingId: string,
  senderId: string,
  input: CreateMessageInput,
): Promise<Message> {
  const booking = await getBookingParticipants(bookingId);
  assertParticipant(booking, senderId);

  const message = await prisma.message.create({
    data: { bookingId, senderId, body: input.body },
  });

  emitToBooking(bookingId, "new_message", {
    id: message.id,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt,
  });

  const recipientId = booking.senderId === senderId ? booking.travelerId : booking.senderId;

  await notificationService.sendToUser(recipientId, {
    title: "New message",
    body: input.body.length > 80 ? `${input.body.slice(0, 80)}...` : input.body,
    data: { bookingId },
  });

  return message;
}

export interface PaginatedMessages {
  items: Message[];
  nextCursor: string | null;
}

export async function getMessages(
  bookingId: string,
  userId: string,
  cursor?: string,
): Promise<PaginatedMessages> {
  const booking = await getBookingParticipants(bookingId);
  assertParticipant(booking, userId);

  const messages = await prisma.message.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = messages.length > MESSAGES_PAGE_SIZE;
  const items = hasMore ? messages.slice(0, MESSAGES_PAGE_SIZE) : messages;
  const nextCursor = hasMore ? items[items.length - 1]!.id : null;

  await prisma.message.updateMany({
    where: { bookingId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return { items, nextCursor };
}
