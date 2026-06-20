import type { Trip } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/errors";
import { toTravelerProfile, type TravelerProfile } from "./trip.service";

const MIN_DAYS_BEFORE_DEPARTURE = 5;
const URGENCY_BONUS_WINDOW_DAYS = 14;
const PRICE_PENALTY_STEP_USD = 0.5;
const PRICE_PENALTY_POINTS_PER_STEP = 5;
const MAX_MATCHES = 10;

const ID_VERIFIED_BONUS = 30;
const FACE_VERIFIED_BONUS = 20;
const TRUST_SCORE_BONUS = 20;
const TRUST_SCORE_THRESHOLD = 4.5;
const EXPERIENCE_BONUS = 15;
const EXPERIENCE_TRIPS_THRESHOLD = 5;
const URGENCY_BONUS = 10;

export interface MatchScoreBreakdown {
  idVerifiedBonus: number;
  faceVerifiedBonus: number;
  trustScoreBonus: number;
  experienceBonus: number;
  pricePenalty: number;
  urgencyBonus: number;
}

export interface TripMatch {
  trip: Omit<Trip, never> & { traveler: TravelerProfile };
  score: number;
  breakdown: MatchScoreBreakdown;
}

function daysUntil(targetDate: Date, from: Date): number {
  return Math.ceil((targetDate.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export async function findMatchesForItemRequest(itemRequestId: string): Promise<TripMatch[]> {
  const itemRequest = await prisma.itemRequest.findUnique({
    where: { id: itemRequestId },
    include: { sender: true },
  });

  if (!itemRequest) {
    throw new NotFoundError("Item request not found");
  }

  const now = new Date();
  const earliestDeparture = new Date(now);
  earliestDeparture.setDate(earliestDeparture.getDate() + MIN_DAYS_BEFORE_DEPARTURE);

  const candidates = await prisma.trip.findMany({
    where: {
      status: "ACTIVE",
      originCountry: itemRequest.sender.country ?? undefined,
      destinationCountry: itemRequest.recipientCountry,
      availableLbs: { gte: itemRequest.weightLbs },
      departureDate: { gte: earliestDeparture },
      allowedCategories: { has: itemRequest.category },
    },
    include: { traveler: true },
  });

  if (candidates.length === 0) {
    return [];
  }

  const cheapestPricePerLb = Math.min(...candidates.map((trip) => trip.pricePerLb));

  const matches = candidates.map((candidate) => {
    const { traveler, ...trip } = candidate;

    const priceAboveCheapest = Math.max(0, trip.pricePerLb - cheapestPricePerLb);
    const penaltySteps = priceAboveCheapest / PRICE_PENALTY_STEP_USD;

    const breakdown: MatchScoreBreakdown = {
      idVerifiedBonus: traveler.isIdVerified ? ID_VERIFIED_BONUS : 0,
      faceVerifiedBonus: traveler.isFaceVerified ? FACE_VERIFIED_BONUS : 0,
      trustScoreBonus: traveler.trustScore >= TRUST_SCORE_THRESHOLD ? TRUST_SCORE_BONUS : 0,
      experienceBonus: traveler.totalTrips >= EXPERIENCE_TRIPS_THRESHOLD ? EXPERIENCE_BONUS : 0,
      pricePenalty: -(penaltySteps * PRICE_PENALTY_POINTS_PER_STEP),
      urgencyBonus: daysUntil(trip.departureDate, now) <= URGENCY_BONUS_WINDOW_DAYS ? URGENCY_BONUS : 0,
    };

    const score =
      breakdown.idVerifiedBonus +
      breakdown.faceVerifiedBonus +
      breakdown.trustScoreBonus +
      breakdown.experienceBonus +
      breakdown.pricePenalty +
      breakdown.urgencyBonus;

    return {
      trip: { ...trip, traveler: toTravelerProfile(traveler) },
      score: Math.round(score * 100) / 100,
      breakdown,
    };
  });

  return matches.sort((a, b) => b.score - a.score).slice(0, MAX_MATCHES);
}
