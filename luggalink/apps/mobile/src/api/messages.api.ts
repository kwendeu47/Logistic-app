import { apiClient } from "./client";
import type { Message } from "../types";

export async function sendMessage(bookingId: string, body: string): Promise<{ message: Message }> {
  const { data } = await apiClient.post<{ message: Message }>(`/bookings/${bookingId}/messages`, { body });
  return data;
}

export interface ListMessagesResult {
  messages: Message[];
  nextCursor: string | null;
}

export async function getMessages(bookingId: string, cursor?: string): Promise<ListMessagesResult> {
  const { data } = await apiClient.get<ListMessagesResult>(`/bookings/${bookingId}/messages`, {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}
