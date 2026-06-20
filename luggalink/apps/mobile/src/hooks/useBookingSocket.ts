import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "../api/client";
import { useBookingStore } from "../store/booking.store";
import type { Booking, Message } from "../types";

interface UseBookingSocketOptions {
  bookingId?: string;
  onQrScanned?: (payload: { bookingId: string; stage: string; timestamp: string }) => void;
}

export function useBookingSocket({ bookingId, onQrScanned }: UseBookingSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const appendMessage = useBookingStore((state) => state.appendMessage);
  const setOffline = useBookingStore((state) => state.setOffline);

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      const token = await getAccessToken();
      if (!token || !isMounted) return;

      const socket = io(API_BASE_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      socket.on("connect", () => setOffline(false));
      socket.on("disconnect", () => setOffline(true));
      socket.on("connect_error", () => setOffline(true));

      socket.on("booking_status_changed", (payload: { bookingId: string; newStatus: Booking["status"] }) => {
        useBookingStore.setState((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === payload.bookingId ? { ...b, status: payload.newStatus } : b,
          ),
        }));
      });

      socket.on("qr_scanned", (payload: { bookingId: string; stage: string; timestamp: string }) => {
        onQrScanned?.(payload);
      });

      socket.on("new_message", (payload: { bookingId: string; message: Message }) => {
        appendMessage(payload.bookingId, payload.message);
      });

      if (bookingId) {
        socket.emit("join_booking", bookingId);
      }

      socketRef.current = socket;
    }

    connect();

    return () => {
      isMounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  return socketRef;
}
