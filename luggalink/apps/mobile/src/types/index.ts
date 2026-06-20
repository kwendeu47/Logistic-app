export type UserRole = "SENDER" | "TRAVELER" | "BOTH" | "ADMIN";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  country: string | null;
  postalAddress: string | null;
  role: UserRole;
  trustScore: number;
  totalTrips: number;
  totalDeliveries: number;
  isPhoneVerified: boolean;
  isIdVerified: boolean;
  isFaceVerified: boolean;
  stripeCustomerId: string | null;
  stripeAccountId: string | null;
  createdAt: string;
}

export type TripStatus = "DRAFT" | "ACTIVE" | "BOOKED" | "COMPLETED" | "CANCELLED";

export interface Trip {
  id: string;
  travelerId: string;
  traveler?: User;
  originCity: string;
  originCountry: string;
  originIataCode: string;
  destinationCity: string;
  destinationCountry: string;
  destinationIataCode: string;
  departureDate: string;
  arrivalDate: string;
  flightNumber: string | null;
  availableLbs: number;
  pricePerLb: number;
  status: TripStatus;
  allowedCategories: ItemCategory[];
  boardingPassUrl: string | null;
}

export type ItemCategory = "ELECTRONICS" | "DOCUMENTS" | "CLOTHING" | "FOOD" | "COSMETICS" | "OTHER";
export type ItemRequestStatus =
  | "PENDING"
  | "MATCHED"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "DISPUTED"
  | "CANCELLED";

export interface ItemRequest {
  id: string;
  senderId: string;
  tripId: string | null;
  name: string;
  description: string;
  category: ItemCategory;
  weightLbs: number;
  declaredValueUsd: number;
  photoUrls: string[];
  status: ItemRequestStatus;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCountry: string;
  trackingNumber: string | null;
}

export type EscrowStatus = "PENDING" | "HELD" | "RELEASED" | "REFUNDED" | "FROZEN";
export type BookingStatus =
  | "PENDING_TRAVELER"
  | "ACCEPTED"
  | "REJECTED"
  | "ACTIVE"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";

export type HandoffStage =
  | "SENDER_POSTED"
  | "TRAVELER_PICKUP"
  | "QR_SCAN_DEPARTURE"
  | "QR_SCAN_ARRIVAL"
  | "RECIPIENT_CONFIRMED";

export interface HandoffLog {
  id: string;
  bookingId: string;
  stage: HandoffStage;
  photoUrls: string[];
  scannedQrCode: string | null;
  signatureUrl: string | null;
  performedByUserId: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  openedByUserId: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  status: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  tripId: string;
  trip?: Trip;
  itemRequestId: string;
  itemRequest?: ItemRequest;
  senderId: string;
  sender?: User;
  travelerId: string;
  traveler?: User;
  agreedPricePerLb: number;
  totalPriceUsd: number;
  platformFeeUsd: number;
  travelerPayoutUsd: number;
  hasInsurance: boolean;
  insuranceFeeUsd: number;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  customsFormUrl: string | null;
  escrowStatus: EscrowStatus;
  qrSealCode: string;
  status: BookingStatus;
  travelerAcceptedAt: string | null;
  itemPostedAt: string | null;
  itemPickedUpAt: string | null;
  deliveredAt: string | null;
  handoffLogs?: HandoffLog[];
  messages?: Message[];
  disputes?: Dispute[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}
