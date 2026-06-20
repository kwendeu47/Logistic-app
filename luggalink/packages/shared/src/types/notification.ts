export type NotificationType =
  | "booking_request"
  | "booking_accepted"
  | "booking_rejected"
  | "payment_received"
  | "trip_reminder"
  | "delivery_confirmed";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
