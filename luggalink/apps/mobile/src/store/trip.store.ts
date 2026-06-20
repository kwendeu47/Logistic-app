import { create } from "zustand";
import type { Trip } from "../types";

interface TripState {
  searchResults: Trip[];
  myTrips: Trip[];
  lastSearchedAt: number | null;
  setSearchResults: (trips: Trip[]) => void;
  setMyTrips: (trips: Trip[]) => void;
  upsertMyTrip: (trip: Trip) => void;
}

export const useTripStore = create<TripState>((set) => ({
  searchResults: [],
  myTrips: [],
  lastSearchedAt: null,

  setSearchResults: (trips) => set({ searchResults: trips, lastSearchedAt: Date.now() }),

  setMyTrips: (trips) => set({ myTrips: trips }),

  upsertMyTrip: (trip) =>
    set((state) => {
      const exists = state.myTrips.some((t) => t.id === trip.id);
      return {
        myTrips: exists ? state.myTrips.map((t) => (t.id === trip.id ? trip : t)) : [trip, ...state.myTrips],
      };
    }),
}));
