import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const traveler = await prisma.user.create({
    data: {
      email: "traveler@luggalink.test",
      phone: "+15550001111",
      passwordHash,
      firstName: "Tariq",
      lastName: "Mwangi",
      role: "TRAVELER",
      isPhoneVerified: true,
      isIdVerified: true,
      totalTrips: 4,
    },
  });

  const sender = await prisma.user.create({
    data: {
      email: "sender@luggalink.test",
      phone: "+15550002222",
      passwordHash,
      firstName: "Amara",
      lastName: "Okafor",
      role: "SENDER",
      isPhoneVerified: true,
    },
  });

  const both = await prisma.user.create({
    data: {
      email: "both@luggalink.test",
      phone: "+15550003333",
      passwordHash,
      firstName: "Lena",
      lastName: "Schmidt",
      role: "BOTH",
      isPhoneVerified: true,
      isIdVerified: true,
      isFaceVerified: true,
      totalTrips: 1,
      totalDeliveries: 2,
    },
  });

  const completedTrip = await prisma.trip.create({
    data: {
      travelerId: traveler.id,
      originCity: "Nairobi",
      originCountry: "Kenya",
      originIataCode: "NBO",
      destinationCity: "London",
      destinationCountry: "United Kingdom",
      destinationIataCode: "LHR",
      departureDate: new Date("2026-05-01T08:00:00Z"),
      arrivalDate: new Date("2026-05-01T18:30:00Z"),
      flightNumber: "KQ100",
      availableLbs: 20,
      pricePerLb: 8,
      status: "COMPLETED",
      allowedCategories: ["ELECTRONICS", "DOCUMENTS", "CLOTHING"],
    },
  });

  await prisma.trip.create({
    data: {
      travelerId: both.id,
      originCity: "Berlin",
      originCountry: "Germany",
      originIataCode: "BER",
      destinationCity: "New York",
      destinationCountry: "United States",
      destinationIataCode: "JFK",
      departureDate: new Date("2026-07-10T09:00:00Z"),
      arrivalDate: new Date("2026-07-10T12:15:00Z"),
      flightNumber: "LH401",
      availableLbs: 15,
      pricePerLb: 10,
      status: "ACTIVE",
      allowedCategories: ["ELECTRONICS", "COSMETICS"],
    },
  });

  const itemRequest = await prisma.itemRequest.create({
    data: {
      senderId: sender.id,
      tripId: completedTrip.id,
      name: "MacBook Air",
      description: "Sealed laptop for cousin's graduation gift",
      category: "ELECTRONICS",
      weightLbs: 3,
      declaredValueUsd: 999,
      photoUrls: ["https://luggalink-uploads.s3.amazonaws.com/items/macbook-1.jpg"],
      status: "DELIVERED",
      recipientName: "John Doe",
      recipientPhone: "+44200000000",
      recipientAddress: "10 Downing Street, London, UK",
    },
  });

  const totalPriceUsd = 3 * 8;
  const platformFeeUsd = totalPriceUsd * 0.1;
  const travelerPayoutUsd = totalPriceUsd - platformFeeUsd;

  const booking = await prisma.booking.create({
    data: {
      tripId: completedTrip.id,
      itemRequestId: itemRequest.id,
      senderId: sender.id,
      travelerId: traveler.id,
      agreedPricePerLb: 8,
      totalPriceUsd,
      platformFeeUsd,
      travelerPayoutUsd,
      stripePaymentIntentId: "pi_seed_test_123",
      escrowStatus: "RELEASED",
      qrSealCode: randomUUID(),
      status: "COMPLETED",
      travelerAcceptedAt: new Date("2026-04-20T10:00:00Z"),
      itemPostedAt: new Date("2026-04-25T09:00:00Z"),
      itemPickedUpAt: new Date("2026-04-30T14:00:00Z"),
      deliveredAt: new Date("2026-05-01T20:00:00Z"),
    },
  });

  await prisma.handoffLog.createMany({
    data: [
      {
        bookingId: booking.id,
        stage: "SENDER_POSTED",
        photoUrls: ["https://luggalink-uploads.s3.amazonaws.com/handoff/posted-1.jpg"],
        performedByUserId: sender.id,
        createdAt: new Date("2026-04-25T09:00:00Z"),
      },
      {
        bookingId: booking.id,
        stage: "TRAVELER_PICKUP",
        photoUrls: ["https://luggalink-uploads.s3.amazonaws.com/handoff/pickup-1.jpg"],
        performedByUserId: traveler.id,
        latitude: -1.2921,
        longitude: 36.8219,
        createdAt: new Date("2026-04-30T14:00:00Z"),
      },
      {
        bookingId: booking.id,
        stage: "QR_SCAN_DEPARTURE",
        photoUrls: [],
        scannedQrCode: booking.qrSealCode,
        performedByUserId: traveler.id,
        latitude: -1.3192,
        longitude: 36.9278,
        createdAt: new Date("2026-05-01T07:30:00Z"),
      },
      {
        bookingId: booking.id,
        stage: "QR_SCAN_ARRIVAL",
        photoUrls: [],
        scannedQrCode: booking.qrSealCode,
        performedByUserId: traveler.id,
        latitude: 51.4700,
        longitude: -0.4543,
        createdAt: new Date("2026-05-01T18:30:00Z"),
      },
      {
        bookingId: booking.id,
        stage: "RECIPIENT_CONFIRMED",
        photoUrls: ["https://luggalink-uploads.s3.amazonaws.com/handoff/delivered-1.jpg"],
        performedByUserId: traveler.id,
        latitude: 51.5034,
        longitude: -0.1276,
        createdAt: new Date("2026-05-01T20:00:00Z"),
      },
    ],
  });

  console.log("Seed complete:", {
    users: [traveler.email, sender.email, both.email],
    trips: 2,
    bookings: 1,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
