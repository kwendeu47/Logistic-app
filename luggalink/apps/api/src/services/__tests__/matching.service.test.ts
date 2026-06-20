import { prisma } from "../../config/prisma";
import { findMatchesForItemRequest } from "../matching.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    itemRequest: { findUnique: jest.fn() },
    trip: { findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  itemRequest: { findUnique: jest.Mock };
  trip: { findMany: jest.Mock };
};

function buildTraveler(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "traveler-1",
    firstName: "Tess",
    lastName: "Traveler",
    avatarUrl: null,
    trustScore: 3,
    totalTrips: 0,
    totalDeliveries: 0,
    isPhoneVerified: true,
    isIdVerified: false,
    isFaceVerified: false,
    ...overrides,
  };
}

function buildTrip(overrides: Partial<Record<string, unknown>> = {}) {
  const departureDate = new Date();
  departureDate.setDate(departureDate.getDate() + 10);

  return {
    id: "trip-1",
    pricePerLb: 5,
    availableLbs: 20,
    departureDate,
    traveler: buildTraveler(),
    ...overrides,
  };
}

describe("findMatchesForItemRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws NotFoundError when the item request does not exist", async () => {
    mockedPrisma.itemRequest.findUnique.mockResolvedValue(null);

    await expect(findMatchesForItemRequest("missing")).rejects.toThrow("Item request not found");
  });

  it("returns an empty array when there are no candidate trips", async () => {
    mockedPrisma.itemRequest.findUnique.mockResolvedValue({
      id: "item-1",
      weightLbs: 5,
      category: "ELECTRONICS",
      recipientCountry: "Kenya",
      sender: { country: "United States" },
    });
    mockedPrisma.trip.findMany.mockResolvedValue([]);

    const matches = await findMatchesForItemRequest("item-1");

    expect(matches).toEqual([]);
  });

  it("ranks verified, experienced travelers above unverified, more expensive ones", async () => {
    mockedPrisma.itemRequest.findUnique.mockResolvedValue({
      id: "item-1",
      weightLbs: 5,
      category: "ELECTRONICS",
      recipientCountry: "Kenya",
      sender: { country: "United States" },
    });

    const strongTrip = buildTrip({
      id: "trip-strong",
      pricePerLb: 5,
      traveler: buildTraveler({
        id: "traveler-strong",
        isIdVerified: true,
        isFaceVerified: true,
        trustScore: 4.8,
        totalTrips: 10,
      }),
    });

    const weakTrip = buildTrip({
      id: "trip-weak",
      pricePerLb: 8,
      traveler: buildTraveler({ id: "traveler-weak" }),
    });

    mockedPrisma.trip.findMany.mockResolvedValue([weakTrip, strongTrip]);

    const matches = await findMatchesForItemRequest("item-1");

    expect(matches).toHaveLength(2);
    expect(matches[0].trip.id).toBe("trip-strong");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[0].breakdown.idVerifiedBonus).toBe(30);
    expect(matches[0].breakdown.faceVerifiedBonus).toBe(20);
    expect(matches[1].breakdown.pricePenalty).toBeLessThan(0);
  });

  it("caps results at 10 matches", async () => {
    mockedPrisma.itemRequest.findUnique.mockResolvedValue({
      id: "item-1",
      weightLbs: 5,
      category: "ELECTRONICS",
      recipientCountry: "Kenya",
      sender: { country: "United States" },
    });

    const trips = Array.from({ length: 15 }, (_, index) =>
      buildTrip({ id: `trip-${index}`, traveler: buildTraveler({ id: `traveler-${index}` }) }),
    );
    mockedPrisma.trip.findMany.mockResolvedValue(trips);

    const matches = await findMatchesForItemRequest("item-1");

    expect(matches).toHaveLength(10);
  });
});
