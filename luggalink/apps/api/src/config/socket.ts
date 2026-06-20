import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";

let io: Server | undefined;

const onlineUserSockets = new Map<string, Set<string>>();

function bookingRoom(bookingId: string): string {
  return `booking:${bookingId}`;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function markUserOnline(userId: string, socketId: string): void {
  const sockets = onlineUserSockets.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  onlineUserSockets.set(userId, sockets);
}

function markUserOffline(userId: string, socketId: string): void {
  const sockets = onlineUserSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUserSockets.delete(userId);
  }
}

export function isUserOnline(userId: string): boolean {
  return onlineUserSockets.has(userId);
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN, credentials: true },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Missing authentication token"));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    markUserOnline(userId, socket.id);
    socket.join(userRoom(userId));

    socket.on("join_booking", (bookingId: string) => {
      if (typeof bookingId === "string" && bookingId.length > 0) {
        socket.join(bookingRoom(bookingId));
      }
    });

    socket.on("disconnect", () => {
      markUserOffline(userId, socket.id);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io has not been initialized");
  }
  return io;
}

export function emitToBooking(bookingId: string, event: string, payload: unknown): void {
  io?.to(bookingRoom(bookingId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
