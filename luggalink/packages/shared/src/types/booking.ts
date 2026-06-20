export type BookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "disputed";

export interface Booking {
  id: string;
  tripId: string;
  senderId: string;
  travelerId: string;
  weightKg: number;
  itemDescription: string;
  totalPrice: number;
  status: BookingStatus;
  paymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}
