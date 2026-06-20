import { apiClient } from "./client";
import type { ItemCategory, Trip } from "../types";

export interface SearchTripsParams {
  originCountry?: string;
  destinationCountry?: string;
  minWeightLbs?: number;
  departureAfter?: string;
}

export async function searchTrips(params: SearchTripsParams): Promise<{ trips: Trip[] }> {
  const { data } = await apiClient.get<{ trips: Trip[] }>("/trips", { params });
  return data;
}

export async function getMyTrips(): Promise<{ trips: Trip[] }> {
  const { data } = await apiClient.get<{ trips: Trip[] }>("/trips/me");
  return data;
}

export async function getTripById(id: string): Promise<{ trip: Trip }> {
  const { data } = await apiClient.get<{ trip: Trip }>(`/trips/${id}`);
  return data;
}

export interface CreateTripInput {
  originCity: string;
  originCountry: string;
  originIataCode: string;
  destinationCity: string;
  destinationCountry: string;
  destinationIataCode: string;
  departureDate: string;
  arrivalDate: string;
  availableLbs: number;
  pricePerLb: number;
  allowedCategories: ItemCategory[];
}

export async function createTrip(input: CreateTripInput): Promise<{ trip: Trip }> {
  const { data } = await apiClient.post<{ trip: Trip }>("/trips", input);
  return data;
}

export async function publishTrip(id: string): Promise<{ trip: Trip }> {
  const { data } = await apiClient.post<{ trip: Trip }>(`/trips/${id}/publish`);
  return data;
}

export async function updateTrip(id: string, input: Partial<CreateTripInput>): Promise<{ trip: Trip }> {
  const { data } = await apiClient.patch<{ trip: Trip }>(`/trips/${id}`, input);
  return data;
}

export async function cancelTrip(id: string): Promise<{ trip: Trip }> {
  const { data } = await apiClient.delete<{ trip: Trip }>(`/trips/${id}`);
  return data;
}

export async function uploadBoardingPass(
  bookingId: string,
  fileUri: string,
): Promise<{ boardingPassUrl: string; autoApplied: boolean }> {
  const formData = new FormData();
  formData.append("boardingPass", {
    uri: fileUri,
    name: "boarding-pass.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  const { data } = await apiClient.post(`/bookings/${bookingId}/boarding-pass`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
