import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { sendEmail } from "../utils/email";

const NEW_ACCOUNT_WINDOW_HOURS = 24;
const HIGH_VALUE_THRESHOLD_USD = 500;

const BOOKING_VELOCITY_WINDOW_MINUTES = 60;
const BOOKING_VELOCITY_THRESHOLD = 3;

const DESTINATION_SPRAY_WINDOW_DAYS = 7;
const DESTINATION_SPRAY_THRESHOLD = 3;

const AIRPORT_MISMATCH_RADIUS_KM = 200;

/**
 * Minimal IATA airport reference data sufficient to sanity-check that a QR
 * scan's GPS coordinates are plausibly near the expected airport's country.
 * In production this should be backed by a full airport database/geocoding
 * service rather than this small embedded table.
 */
const AIRPORT_COORDINATES: Record<string, { country: string; lat: number; lng: number }> = {
  JFK: { country: "United States", lat: 40.6413, lng: -73.7781 },
  LAX: { country: "United States", lat: 33.9416, lng: -118.4085 },
  ORD: { country: "United States", lat: 41.9742, lng: -87.9073 },
  LHR: { country: "United Kingdom", lat: 51.4700, lng: -0.4543 },
  CDG: { country: "France", lat: 49.0097, lng: 2.5479 },
  DXB: { country: "United Arab Emirates", lat: 25.2532, lng: 55.3657 },
  NBO: { country: "Kenya", lat: -1.3192, lng: 36.9278 },
  LOS: { country: "Nigeria", lat: 6.5774, lng: 3.3212 },
  JNB: { country: "South Africa", lat: -26.1392, lng: 28.246 },
  ACC: { country: "Ghana", lat: 5.6052, lng: -0.1719 },
  DEL: { country: "India", lat: 28.5562, lng: 77.1 },
  MNL: { country: "Philippines", lat: 14.5086, lng: 121.0194 },
};

function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

interface CreateAlertInput {
  reason:
    | "NEW_ACCOUNT_HIGH_VALUE"
    | "BOOKING_VELOCITY"
    | "TRAVELER_DESTINATION_SPRAY"
    | "GPS_AIRPORT_MISMATCH";
  userId?: string;
  bookingId?: string;
  details: Record<string, unknown>;
}

async function createAlertAndNotifyAdmins(input: CreateAlertInput): Promise<void> {
  const alert = await prisma.fraudAlert.create({
    data: {
      reason: input.reason,
      userId: input.userId,
      bookingId: input.bookingId,
      details: input.details as Prisma.InputJsonValue,
    },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });

  await Promise.all(
    admins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject: `[LuggaLink Fraud Alert] ${input.reason}`,
        html: `
          <p>A fraud detection rule was triggered.</p>
          <ul>
            <li><strong>Reason:</strong> ${input.reason}</li>
            <li><strong>Alert ID:</strong> ${alert.id}</li>
            ${input.userId ? `<li><strong>User:</strong> ${input.userId}</li>` : ""}
            ${input.bookingId ? `<li><strong>Booking:</strong> ${input.bookingId}</li>` : ""}
          </ul>
          <pre>${JSON.stringify(input.details, null, 2)}</pre>
        `,
      }),
    ),
  );
}

/**
 * Flags a booking if the sender's account is less than 24h old and the
 * declared value of the item exceeds the high-value threshold.
 */
export async function checkNewAccountHighValue(input: {
  bookingId: string;
  senderId: string;
  senderCreatedAt: Date;
  declaredValueUsd: number;
}): Promise<boolean> {
  const accountAgeHours = (Date.now() - input.senderCreatedAt.getTime()) / (1000 * 60 * 60);
  const isFlagged = accountAgeHours < NEW_ACCOUNT_WINDOW_HOURS && input.declaredValueUsd > HIGH_VALUE_THRESHOLD_USD;

  if (isFlagged) {
    await createAlertAndNotifyAdmins({
      reason: "NEW_ACCOUNT_HIGH_VALUE",
      userId: input.senderId,
      bookingId: input.bookingId,
      details: { accountAgeHours, declaredValueUsd: input.declaredValueUsd },
    });
  }

  return isFlagged;
}

/**
 * Flags a sender who has created more than the threshold number of bookings
 * within the trailing velocity window.
 */
export async function checkBookingVelocity(input: { senderId: string; bookingId: string }): Promise<boolean> {
  const windowStart = new Date(Date.now() - BOOKING_VELOCITY_WINDOW_MINUTES * 60 * 1000);

  const recentBookingCount = await prisma.booking.count({
    where: { senderId: input.senderId, createdAt: { gte: windowStart } },
  });

  const isFlagged = recentBookingCount > BOOKING_VELOCITY_THRESHOLD;

  if (isFlagged) {
    await createAlertAndNotifyAdmins({
      reason: "BOOKING_VELOCITY",
      userId: input.senderId,
      bookingId: input.bookingId,
      details: { recentBookingCount, windowMinutes: BOOKING_VELOCITY_WINDOW_MINUTES },
    });
  }

  return isFlagged;
}

/**
 * Flags a traveler who has published trips to 3+ distinct destination
 * countries within the trailing week — a pattern associated with mule
 * accounts spraying listings rather than planning real trips.
 */
export async function checkTravelerDestinationSpray(input: { travelerId: string }): Promise<boolean> {
  const windowStart = new Date(Date.now() - DESTINATION_SPRAY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const recentTrips = await prisma.trip.findMany({
    where: { travelerId: input.travelerId, createdAt: { gte: windowStart } },
    select: { destinationCountry: true },
  });

  const distinctDestinations = new Set(recentTrips.map((trip) => trip.destinationCountry));
  const isFlagged = distinctDestinations.size >= DESTINATION_SPRAY_THRESHOLD;

  if (isFlagged) {
    await createAlertAndNotifyAdmins({
      reason: "TRAVELER_DESTINATION_SPRAY",
      userId: input.travelerId,
      details: { distinctDestinations: Array.from(distinctDestinations), windowDays: DESTINATION_SPRAY_WINDOW_DAYS },
    });
  }

  return isFlagged;
}

/**
 * Flags a QR scan if the reported GPS coordinates are implausibly far from
 * the expected airport for that leg of the trip.
 */
export async function checkGpsAirportMismatch(input: {
  bookingId: string;
  performedByUserId: string;
  expectedIataCode: string;
  latitude?: number;
  longitude?: number;
}): Promise<boolean> {
  if (input.latitude === undefined || input.longitude === undefined) {
    return false;
  }

  const airport = AIRPORT_COORDINATES[input.expectedIataCode];
  if (!airport) {
    return false;
  }

  const distanceKm = haversineDistanceKm(
    { lat: airport.lat, lng: airport.lng },
    { lat: input.latitude, lng: input.longitude },
  );

  const isFlagged = distanceKm > AIRPORT_MISMATCH_RADIUS_KM;

  if (isFlagged) {
    await createAlertAndNotifyAdmins({
      reason: "GPS_AIRPORT_MISMATCH",
      userId: input.performedByUserId,
      bookingId: input.bookingId,
      details: {
        expectedIataCode: input.expectedIataCode,
        expectedCountry: airport.country,
        distanceKm: Math.round(distanceKm),
        scannedLatitude: input.latitude,
        scannedLongitude: input.longitude,
      },
    });
  }

  return isFlagged;
}
