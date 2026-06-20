import { apiClient } from "./client";
import type { Booking, HandoffStage } from "../types";

export interface CreateBookingInput {
  itemRequestId: string;
  tripId: string;
  hasInsurance?: boolean;
}

export interface CreateBookingResult {
  booking: Booking;
  stripeClientSecret: string | null;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { data } = await apiClient.post<CreateBookingResult>("/bookings", input);
  return data;
}

export async function getMyBookings(): Promise<{ bookings: Booking[] }> {
  const { data } = await apiClient.get<{ bookings: Booking[] }>("/bookings/me");
  return data;
}

export async function getBookingById(id: string): Promise<{ booking: Booking }> {
  const { data } = await apiClient.get<{ booking: Booking }>(`/bookings/${id}`);
  return data;
}

export async function acceptBooking(id: string): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post<{ booking: Booking }>(`/bookings/${id}/accept`);
  return data;
}

export async function rejectBooking(id: string): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post<{ booking: Booking }>(`/bookings/${id}/reject`);
  return data;
}

export async function reportItemPosted(
  id: string,
  input: { trackingNumber: string; photoUrls: string[] },
): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post<{ booking: Booking }>(`/bookings/${id}/item-posted`, input);
  return data;
}

export async function confirmPickup(
  id: string,
  input: { photoUrls: string[]; scannedQrCode: string; latitude?: number; longitude?: number },
): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post<{ booking: Booking }>(`/bookings/${id}/pickup-confirmed`, input);
  return data;
}

export async function confirmDelivery(
  id: string,
  input: {
    photoUrls: string[];
    scannedQrCode: string;
    recipientSignature: string;
    latitude?: number;
    longitude?: number;
  },
): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post<{ booking: Booking }>(`/bookings/${id}/delivery-confirmed`, input);
  return data;
}

export async function scanQrCheckpoint(
  id: string,
  input: {
    scannedCode: string;
    stage: HandoffStage & ("QR_SCAN_DEPARTURE" | "QR_SCAN_ARRIVAL");
    photoUrls: string[];
    latitude?: number;
    longitude?: number;
  },
): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post<{ booking: Booking }>(`/bookings/${id}/scan-qr`, input);
  return data;
}

export async function openDispute(
  id: string,
  input: { reason: string; description: string; evidenceUrls?: string[] },
): Promise<{ dispute: unknown }> {
  const { data } = await apiClient.post(`/bookings/${id}/dispute`, input);
  return data;
}

export function qrSealImageUrl(bookingId: string, baseUrl: string): string {
  return `${baseUrl}/bookings/${bookingId}/qr-seal.png`;
}

export function customsFormUrl(bookingId: string, baseUrl: string): string {
  return `${baseUrl}/bookings/${bookingId}/customs-form.pdf`;
}

export async function uploadPhoto(uri: string): Promise<string> {
  const formData = new FormData();
  formData.append("photo", { uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  const { data } = await apiClient.post<{ url: string }>("/uploads/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}
