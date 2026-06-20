import { create } from "zustand";
import type { Booking, Message } from "../types";

interface BookingState {
  bookings: Booking[];
  activeBookingId: string | null;
  messagesByBooking: Record<string, Message[]>;
  isOffline: boolean;
  pendingActions: Array<{ id: string; description: string }>;
  setBookings: (bookings: Booking[]) => void;
  upsertBooking: (booking: Booking) => void;
  setActiveBookingId: (id: string | null) => void;
  setMessages: (bookingId: string, messages: Message[]) => void;
  appendMessage: (bookingId: string, message: Message) => void;
  setOffline: (offline: boolean) => void;
  queuePendingAction: (id: string, description: string) => void;
  clearPendingAction: (id: string) => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  activeBookingId: null,
  messagesByBooking: {},
  isOffline: false,
  pendingActions: [],

  setBookings: (bookings) => set({ bookings }),

  upsertBooking: (booking) =>
    set((state) => {
      const exists = state.bookings.some((b) => b.id === booking.id);
      return {
        bookings: exists
          ? state.bookings.map((b) => (b.id === booking.id ? booking : b))
          : [booking, ...state.bookings],
      };
    }),

  setActiveBookingId: (id) => set({ activeBookingId: id }),

  setMessages: (bookingId, messages) =>
    set((state) => ({ messagesByBooking: { ...state.messagesByBooking, [bookingId]: messages } })),

  appendMessage: (bookingId, message) =>
    set((state) => {
      const existing = state.messagesByBooking[bookingId] ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      return { messagesByBooking: { ...state.messagesByBooking, [bookingId]: [...existing, message] } };
    }),

  setOffline: (offline) => set({ isOffline: offline }),

  queuePendingAction: (id, description) =>
    set((state) => ({ pendingActions: [...state.pendingActions, { id, description }] })),

  clearPendingAction: (id) =>
    set((state) => ({ pendingActions: state.pendingActions.filter((a) => a.id !== id) })),
}));
