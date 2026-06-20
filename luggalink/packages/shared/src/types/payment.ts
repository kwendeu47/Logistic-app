export type PaymentStatus =
  | "requires_payment_method"
  | "requires_capture"
  | "succeeded"
  | "refunded"
  | "failed";

export interface Payment {
  id: string;
  bookingId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}
