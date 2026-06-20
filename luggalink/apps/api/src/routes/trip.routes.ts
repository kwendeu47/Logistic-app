import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as matchingService from "../services/matching.service";
import * as tripService from "../services/trip.service";

export const tripRouter = Router();

tripRouter.post(
  "/",
  requireAuth,
  requireRole("TRAVELER", "BOTH"),
  validate(tripService.createTripSchema),
  async (req, res) => {
    const trip = await tripService.createTrip(req.user!.id, req.body);
    res.status(201).json({ trip });
  },
);

tripRouter.post("/:id/publish", requireAuth, async (req, res) => {
  const trip = await tripService.publishTrip(String(req.params.id), req.user!.id);
  res.json({ trip });
});

tripRouter.get("/", validate(tripService.searchTripsSchema, "query"), async (req, res) => {
  const result = await tripService.searchTrips(req.query as unknown as tripService.SearchTripsQuery);
  res.json(result);
});

tripRouter.get("/me", requireAuth, async (req, res) => {
  const trips = await tripService.getMyTrips(req.user!.id);
  res.json({ trips });
});

tripRouter.get("/matches/:itemRequestId", requireAuth, async (req, res) => {
  const matches = await matchingService.findMatchesForItemRequest(String(req.params.itemRequestId));
  res.json({ matches });
});

tripRouter.get("/:id", async (req, res) => {
  const trip = await tripService.getTripById(String(req.params.id));
  res.json({ trip });
});

tripRouter.patch("/:id", requireAuth, validate(tripService.updateTripSchema), async (req, res) => {
  const trip = await tripService.updateTrip(String(req.params.id), req.user!.id, req.body);
  res.json({ trip });
});

tripRouter.delete("/:id", requireAuth, async (req, res) => {
  const trip = await tripService.cancelTrip(String(req.params.id), req.user!.id);
  res.json({ trip });
});
