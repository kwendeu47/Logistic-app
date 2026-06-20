import { ItemCategory, type Prisma, type Trip, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";

export const createTripSchema = z.object({
  originCity: z.string().min(1),
  originCountry: z.string().min(1),
  originIataCode: z.string().length(3),
  destinationCity: z.string().min(1),
  destinationCountry: z.string().min(1),
  destinationIataCode: z.string().length(3),
  departureDate: z.coerce.date(),
  arrivalDate: z.coerce.date(),
  flightNumber: z.string().optional(),
  availableLbs: z.number().positive(),
  pricePerLb: z.number().positive(),
  allowedCategories: z.array(z.nativeEnum(ItemCategory)).min(1),
  boardingPassUrl: z.string().url().optional(),
});

export const updateTripSchema = createTripSchema.partial();

export const searchTripsSchema = z.object({
  originCountry: z.string().optional(),
  destinationCountry: z.string().optional(),
  departureDateFrom: z.coerce.date().optional(),
  departureDateTo: z.coerce.date().optional(),
  minLbs: z.coerce.number().optional(),
  maxPricePerLb: z.coerce.number().optional(),
  category: z.nativeEnum(ItemCategory).optional(),
  sort: z.enum(["relevance", "price", "trustScore"]).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type SearchTripsQuery = z.infer<typeof searchTripsSchema>;

const PUBLISH_MIN_DAYS_OUT = 3;

const RESERVED_ITEM_STATUSES = ["MATCHED", "CONFIRMED", "IN_TRANSIT", "DELIVERED"] as const;
const BLOCKING_BOOKING_STATUSES = ["ACCEPTED", "ACTIVE", "COMPLETED", "DISPUTED"] as const;
const EDITABLE_TRIP_STATUSES = ["DRAFT", "ACTIVE"] as const;

export interface TravelerProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  trustScore: number;
  totalTrips: number;
  totalDeliveries: number;
  isPhoneVerified: boolean;
  isIdVerified: boolean;
  isFaceVerified: boolean;
}

export function toTravelerProfile(user: User): TravelerProfile {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    trustScore: user.trustScore,
    totalTrips: user.totalTrips,
    totalDeliveries: user.totalDeliveries,
    isPhoneVerified: user.isPhoneVerified,
    isIdVerified: user.isIdVerified,
    isFaceVerified: user.isFaceVerified,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function getOwnedTrip(tripId: string, userId: string): Promise<Trip> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    throw new NotFoundError("Trip not found");
  }
  if (trip.travelerId !== userId) {
    throw new ForbiddenError("You do not own this trip");
  }
  return trip;
}

export async function createTrip(travelerId: string, input: CreateTripInput): Promise<Trip> {
  const traveler = await prisma.user.findUnique({ where: { id: travelerId } });
  if (!traveler) {
    throw new NotFoundError("User not found");
  }
  if (!traveler.isPhoneVerified) {
    throw new ForbiddenError("Phone verification is required to create a trip");
  }

  return prisma.trip.create({
    data: { ...input, travelerId, status: "DRAFT" },
  });
}

export async function publishTrip(tripId: string, userId: string): Promise<Trip> {
  const trip = await getOwnedTrip(tripId, userId);

  const hasBoardingPass = Boolean(trip.boardingPassUrl);
  const isFarEnoughOut = trip.departureDate >= addDays(new Date(), PUBLISH_MIN_DAYS_OUT);

  if (!hasBoardingPass && !isFarEnoughOut) {
    throw new BadRequestError(
      `Trip must have a boarding pass uploaded, or depart at least ${PUBLISH_MIN_DAYS_OUT} days from now, to publish`,
    );
  }

  return prisma.trip.update({ where: { id: tripId }, data: { status: "ACTIVE" } });
}

function buildSearchWhere(query: SearchTripsQuery): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = { status: "ACTIVE" };

  if (query.originCountry) where.originCountry = query.originCountry;
  if (query.destinationCountry) where.destinationCountry = query.destinationCountry;

  if (query.departureDateFrom || query.departureDateTo) {
    where.departureDate = {
      ...(query.departureDateFrom ? { gte: query.departureDateFrom } : {}),
      ...(query.departureDateTo ? { lte: query.departureDateTo } : {}),
    };
  }

  if (query.minLbs !== undefined) where.availableLbs = { gte: query.minLbs };
  if (query.maxPricePerLb !== undefined) where.pricePerLb = { lte: query.maxPricePerLb };
  if (query.category) where.allowedCategories = { has: query.category };

  return where;
}

function buildSearchOrderBy(sort: SearchTripsQuery["sort"]): Prisma.TripOrderByWithRelationInput {
  switch (sort) {
    case "price":
      return { pricePerLb: "asc" };
    case "trustScore":
      return { traveler: { trustScore: "desc" } };
    case "relevance":
    default:
      return { departureDate: "asc" };
  }
}

export interface PaginatedTrips {
  items: Array<Trip & { traveler: TravelerProfile }>;
  page: number;
  pageSize: number;
  total: number;
}

export async function searchTrips(query: SearchTripsQuery): Promise<PaginatedTrips> {
  const where = buildSearchWhere(query);
  const orderBy = buildSearchOrderBy(query.sort);

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { traveler: true },
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    items: trips.map(({ traveler, ...trip }) => ({ ...trip, traveler: toTravelerProfile(traveler) })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export interface TripWithAvailability extends Omit<Trip, never> {
  traveler: TravelerProfile;
  availability: {
    totalLbs: number;
    reservedLbs: number;
    remainingLbs: number;
  };
}

export async function getTripById(id: string): Promise<TripWithAvailability> {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { traveler: true, itemRequests: true },
  });

  if (!trip) {
    throw new NotFoundError("Trip not found");
  }

  const reservedLbs = trip.itemRequests
    .filter((item) => RESERVED_ITEM_STATUSES.includes(item.status as (typeof RESERVED_ITEM_STATUSES)[number]))
    .reduce((sum, item) => sum + item.weightLbs, 0);

  const { itemRequests: _itemRequests, traveler, ...rest } = trip;

  return {
    ...rest,
    traveler: toTravelerProfile(traveler),
    availability: {
      totalLbs: trip.availableLbs,
      reservedLbs,
      remainingLbs: Math.max(trip.availableLbs - reservedLbs, 0),
    },
  };
}

export async function updateTrip(tripId: string, userId: string, data: UpdateTripInput): Promise<Trip> {
  const trip = await getOwnedTrip(tripId, userId);

  if (!EDITABLE_TRIP_STATUSES.includes(trip.status as (typeof EDITABLE_TRIP_STATUSES)[number])) {
    throw new BadRequestError("Trip can only be edited while in DRAFT or ACTIVE status");
  }

  const hasAcceptedBooking = await prisma.booking.findFirst({
    where: { tripId, status: { in: [...BLOCKING_BOOKING_STATUSES] } },
  });

  if (hasAcceptedBooking) {
    throw new BadRequestError("Trip cannot be edited because it already has accepted bookings");
  }

  return prisma.trip.update({ where: { id: tripId }, data });
}

export async function cancelTrip(tripId: string, userId: string): Promise<Trip> {
  await getOwnedTrip(tripId, userId);
  return prisma.trip.update({ where: { id: tripId }, data: { status: "CANCELLED" } });
}

export async function getMyTrips(travelerId: string): Promise<Trip[]> {
  return prisma.trip.findMany({
    where: { travelerId },
    orderBy: { departureDate: "desc" },
  });
}
