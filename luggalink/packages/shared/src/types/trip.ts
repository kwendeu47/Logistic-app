export type TripStatus = "upcoming" | "in_transit" | "completed" | "cancelled";

export interface Trip {
  id: string;
  travelerId: string;
  originAirport: string;
  destinationAirport: string;
  departureDate: string;
  arrivalDate: string;
  availableWeightKg: number;
  pricePerKg: number;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
}
