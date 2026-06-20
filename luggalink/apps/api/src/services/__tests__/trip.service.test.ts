import { prisma } from "../../config/prisma";
import * as fraudService from "../fraud.service";
import {
  createTrip,
  publishTrip,
  searchTrips,
  getTripById,
  updateTrip,
  cancelTrip,
  getMyTrips,
  toTravelerProfile,
} from "../trip.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    trip: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    booking: { findFirst: jest.fn() },
  },
}));

jest.mock("../fraud.service", () => ({
  checkTravelerDestinationSpray: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  trip: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  booking: { findFirst: jest.Mock };
};

const traveler = {
  id: "traveler-1",
  firstName: "Tom",
  lastName: "Traveler",
  avatarUrl: null,
  trustScore: 80,
  totalTrips: 3,
  totalDeliveries: 2,
  isPhoneVerified: true,
  isIdVerified: true,
  isFaceVerified: true,
};

describe("trip.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toTravelerProfile", () => {
    it("projects only the public traveler fields", () => {
      const result = toTravelerProfile({ ...traveler, email: "secret@b.com" } as any);

      expect(result).not.toHaveProperty("email");
      expect(result.id).toBe("traveler-1");
    });
  });

  describe("createTrip", () => {
    it("creates a draft trip when the traveler is phone verified", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "traveler-1", isPhoneVerified: true });
      mockedPrisma.trip.create.mockResolvedValue({ id: "trip-1", status: "DRAFT" });

      const result = await createTrip("traveler-1", {
        originCity: "NYC",
        originCountry: "US",
        originIataCode: "JFK",
        destinationCity: "LON",
        destinationCountry: "UK",
        destinationIataCode: "LHR",
        departureDate: new Date(),
        arrivalDate: new Date(),
        availableLbs: 20,
        pricePerLb: 5,
        allowedCategories: ["ELECTRONICS"] as any,
      } as any);

      expect(mockedPrisma.trip.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ travelerId: "traveler-1", status: "DRAFT" }),
      });
      expect(result.status).toBe("DRAFT");
    });

    it("throws NotFoundError when the traveler does not exist", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createTrip("missing", {} as any)).rejects.toThrow("User not found");
    });

    it("throws ForbiddenError when the traveler is not phone verified", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "traveler-1", isPhoneVerified: false });

      await expect(createTrip("traveler-1", {} as any)).rejects.toThrow(
        "Phone verification is required to create a trip",
      );
    });
  });

  describe("publishTrip", () => {
    it("publishes a trip with a boarding pass regardless of departure date", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "traveler-1",
        boardingPassUrl: "https://example.com/pass.pdf",
        departureDate: new Date(),
      });
      mockedPrisma.trip.update.mockResolvedValue({ id: "trip-1", status: "ACTIVE" });
      (fraudService.checkTravelerDestinationSpray as jest.Mock).mockResolvedValue(undefined);

      const result = await publishTrip("trip-1", "traveler-1");

      expect(result.status).toBe("ACTIVE");
      expect(fraudService.checkTravelerDestinationSpray).toHaveBeenCalledWith({
        travelerId: "traveler-1",
      });
    });

    it("publishes a trip without a boarding pass if departure is far enough out", async () => {
      const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "traveler-1",
        boardingPassUrl: null,
        departureDate: farFuture,
      });
      mockedPrisma.trip.update.mockResolvedValue({ id: "trip-1", status: "ACTIVE" });

      const result = await publishTrip("trip-1", "traveler-1");

      expect(result.status).toBe("ACTIVE");
    });

    it("rejects when there is no boarding pass and departure is too soon", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "traveler-1",
        boardingPassUrl: null,
        departureDate: new Date(),
      });

      await expect(publishTrip("trip-1", "traveler-1")).rejects.toThrow(
        /Trip must have a boarding pass uploaded/,
      );
    });

    it("throws NotFoundError when the trip does not exist", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue(null);

      await expect(publishTrip("missing", "traveler-1")).rejects.toThrow("Trip not found");
    });

    it("throws ForbiddenError when the user does not own the trip", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "someone-else",
      });

      await expect(publishTrip("trip-1", "traveler-1")).rejects.toThrow(
        "You do not own this trip",
      );
    });
  });

  describe("searchTrips", () => {
    it("builds where/orderBy filters and maps traveler profiles for relevance sort", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([
        { id: "trip-1", traveler },
      ]);
      mockedPrisma.trip.count.mockResolvedValue(1);

      const result = await searchTrips({
        sort: "relevance",
        page: 1,
        pageSize: 20,
        originCountry: "US",
        destinationCountry: "UK",
        minLbs: 5,
        maxPricePerLb: 10,
        category: "ELECTRONICS",
      } as any);

      expect(mockedPrisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
            originCountry: "US",
            destinationCountry: "UK",
            availableLbs: { gte: 5 },
            pricePerLb: { lte: 10 },
            allowedCategories: { has: "ELECTRONICS" },
          }),
          orderBy: { departureDate: "asc" },
        }),
      );
      expect(result.items[0]!.traveler.id).toBe("traveler-1");
      expect(result.total).toBe(1);
    });

    it("sorts by price when requested", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([]);
      mockedPrisma.trip.count.mockResolvedValue(0);

      await searchTrips({ sort: "price", page: 1, pageSize: 20 } as any);

      expect(mockedPrisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { pricePerLb: "asc" } }),
      );
    });

    it("sorts by trustScore when requested", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([]);
      mockedPrisma.trip.count.mockResolvedValue(0);

      await searchTrips({ sort: "trustScore", page: 1, pageSize: 20 } as any);

      expect(mockedPrisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { traveler: { trustScore: "desc" } } }),
      );
    });

    it("applies departure date range filters", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([]);
      mockedPrisma.trip.count.mockResolvedValue(0);
      const from = new Date("2026-01-01");
      const to = new Date("2026-02-01");

      await searchTrips({
        sort: "relevance",
        page: 1,
        pageSize: 20,
        departureDateFrom: from,
        departureDateTo: to,
      } as any);

      expect(mockedPrisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ departureDate: { gte: from, lte: to } }),
        }),
      );
    });
  });

  describe("getTripById", () => {
    it("computes reserved and remaining lbs from active item requests", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        availableLbs: 50,
        traveler,
        itemRequests: [
          { status: "MATCHED", weightLbs: 10 },
          { status: "PENDING", weightLbs: 5 },
          { status: "DELIVERED", weightLbs: 8 },
        ],
      });

      const result = await getTripById("trip-1");

      expect(result.availability).toEqual({
        totalLbs: 50,
        reservedLbs: 18,
        remainingLbs: 32,
      });
      expect(result.traveler.id).toBe("traveler-1");
    });

    it("never returns negative remainingLbs", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        availableLbs: 5,
        traveler,
        itemRequests: [{ status: "MATCHED", weightLbs: 20 }],
      });

      const result = await getTripById("trip-1");

      expect(result.availability.remainingLbs).toBe(0);
    });

    it("throws NotFoundError when the trip does not exist", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue(null);

      await expect(getTripById("missing")).rejects.toThrow("Trip not found");
    });
  });

  describe("updateTrip", () => {
    it("updates an editable trip with no blocking bookings", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "traveler-1",
        status: "DRAFT",
      });
      mockedPrisma.booking.findFirst.mockResolvedValue(null);
      mockedPrisma.trip.update.mockResolvedValue({ id: "trip-1", availableLbs: 30 });

      const result = await updateTrip("trip-1", "traveler-1", { availableLbs: 30 } as any);

      expect(result.availableLbs).toBe(30);
    });

    it("throws BadRequestError when the trip status is not editable", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "traveler-1",
        status: "CANCELLED",
      });

      await expect(updateTrip("trip-1", "traveler-1", {} as any)).rejects.toThrow(
        "Trip can only be edited while in DRAFT or ACTIVE status",
      );
    });

    it("throws BadRequestError when there is a blocking booking", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "traveler-1",
        status: "ACTIVE",
      });
      mockedPrisma.booking.findFirst.mockResolvedValue({ id: "booking-1" });

      await expect(updateTrip("trip-1", "traveler-1", {} as any)).rejects.toThrow(
        "Trip cannot be edited because it already has accepted bookings",
      );
    });

    it("throws ForbiddenError when the user does not own the trip", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({
        id: "trip-1",
        travelerId: "someone-else",
        status: "DRAFT",
      });

      await expect(updateTrip("trip-1", "traveler-1", {} as any)).rejects.toThrow(
        "You do not own this trip",
      );
    });
  });

  describe("cancelTrip", () => {
    it("cancels an owned trip", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({ id: "trip-1", travelerId: "traveler-1" });
      mockedPrisma.trip.update.mockResolvedValue({ id: "trip-1", status: "CANCELLED" });

      const result = await cancelTrip("trip-1", "traveler-1");

      expect(result.status).toBe("CANCELLED");
    });

    it("throws ForbiddenError when the user does not own the trip", async () => {
      mockedPrisma.trip.findUnique.mockResolvedValue({ id: "trip-1", travelerId: "someone-else" });

      await expect(cancelTrip("trip-1", "traveler-1")).rejects.toThrow(
        "You do not own this trip",
      );
    });
  });

  describe("getMyTrips", () => {
    it("returns trips for the given traveler ordered by departure date desc", async () => {
      mockedPrisma.trip.findMany.mockResolvedValue([{ id: "trip-1" }]);

      const result = await getMyTrips("traveler-1");

      expect(mockedPrisma.trip.findMany).toHaveBeenCalledWith({
        where: { travelerId: "traveler-1" },
        orderBy: { departureDate: "desc" },
      });
      expect(result).toHaveLength(1);
    });
  });
});
