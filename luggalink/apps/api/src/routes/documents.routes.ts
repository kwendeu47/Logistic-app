import { AnalyzeDocumentCommand, TextractClient } from "@aws-sdk/client-textract";
import { Router } from "express";
import { prisma } from "../config/prisma";
import { emitToBooking } from "../config/socket";
import { requireAuth } from "../middleware/auth";
import { uploadSingleImage } from "../middleware/upload";
import { validate } from "../middleware/validate";
import * as bookingService from "../services/booking.service";
import * as customsService from "../services/customs.service";
import * as qrService from "../services/qr.service";
import { logAuditEvent } from "../utils/audit";
import { uploadToS3 } from "../utils/s3";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";

export const documentsRouter = Router();

const textractClient = new TextractClient({ region: process.env.AWS_REGION });

const OCR_CONFIDENCE_THRESHOLD = 80;

async function getBookingForDocuments(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { trip: true, itemRequest: true, sender: true, traveler: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

documentsRouter.get("/:id/qr-seal.png", requireAuth, async (req, res) => {
  const bookingId = String(req.params.id);
  const booking = await getBookingForDocuments(bookingId);

  if (booking.senderId !== req.user!.id && booking.travelerId !== req.user!.id) {
    throw new ForbiddenError("You are not a party to this booking");
  }

  const buffer = await qrService.generateWatermarkedSealImage(booking.qrSealCode, booking.id);

  res.setHeader("Content-Type", "image/png");
  res.send(buffer);
});

documentsRouter.post(
  "/:id/scan-qr",
  requireAuth,
  validate(bookingService.scanQrSchema),
  async (req, res) => {
    const bookingId = String(req.params.id);
    const updated = await bookingService.scanQrCheckpoint(bookingId, req.user!.id, req.body);

    emitToBooking(bookingId, "booking_status_changed", {
      bookingId,
      newStatus: updated.status,
    });

    res.json({ booking: updated });
  },
);

documentsRouter.get("/:id/customs-form.pdf", requireAuth, async (req, res) => {
  const bookingId = String(req.params.id);
  const booking = await getBookingForDocuments(bookingId);

  if (booking.senderId !== req.user!.id && booking.travelerId !== req.user!.id) {
    throw new ForbiddenError("You are not a party to this booking");
  }

  const buffer = await customsService.generateCustomsForm(
    { id: booking.id },
    {
      name: booking.itemRequest.name,
      description: booking.itemRequest.description,
      weightLbs: booking.itemRequest.weightLbs,
      declaredValueUsd: booking.itemRequest.declaredValueUsd,
      category: booking.itemRequest.category,
      recipientName: booking.itemRequest.recipientName,
      recipientAddress: booking.itemRequest.recipientAddress,
      recipientCountry: booking.itemRequest.recipientCountry,
    },
    booking.sender,
    booking.traveler,
  );

  const url = await uploadToS3({
    key: `customs-forms/${booking.id}.pdf`,
    body: buffer,
    contentType: "application/pdf",
  });

  await prisma.booking.update({ where: { id: booking.id }, data: { customsFormUrl: url } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="customs-form-${booking.id}.pdf"`);
  res.send(buffer);
});

interface ExtractedBoardingPassField {
  value: string;
  confidence: number;
}

interface ExtractedBoardingPassData {
  flightNumber?: ExtractedBoardingPassField;
  departureDate?: ExtractedBoardingPassField;
  originIataCode?: ExtractedBoardingPassField;
  destinationIataCode?: ExtractedBoardingPassField;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

function matchFieldKey(normalizedKey: string): keyof ExtractedBoardingPassData | undefined {
  if (normalizedKey.includes("flight")) return "flightNumber";
  if (normalizedKey.includes("date")) return "departureDate";
  if (normalizedKey.includes("origin") || normalizedKey.includes("from")) return "originIataCode";
  if (normalizedKey.includes("destination") || normalizedKey.includes("to")) return "destinationIataCode";
  return undefined;
}

async function extractBoardingPassFields(buffer: Buffer): Promise<ExtractedBoardingPassData> {
  const result = await textractClient.send(
    new AnalyzeDocumentCommand({
      Document: { Bytes: buffer },
      FeatureTypes: ["FORMS"],
    }),
  );

  const blocks = result.Blocks ?? [];
  const blockById = new Map(blocks.map((block) => [block.Id, block]));

  function getBlockText(block: (typeof blocks)[number] | undefined): string {
    if (!block?.Relationships) return "";
    const childIds = block.Relationships.filter((r) => r.Type === "CHILD").flatMap((r) => r.Ids ?? []);
    return childIds
      .map((id) => blockById.get(id))
      .filter((child): child is NonNullable<typeof child> => Boolean(child) && child!.BlockType === "WORD")
      .map((child) => child!.Text ?? "")
      .join(" ")
      .trim();
  }

  const extracted: ExtractedBoardingPassData = {};

  for (const block of blocks) {
    if (block.BlockType !== "KEY_VALUE_SET" || !block.EntityTypes?.includes("KEY")) {
      continue;
    }

    const keyText = normalizeKey(getBlockText(block));
    const fieldKey = matchFieldKey(keyText);
    if (!fieldKey) continue;

    const valueIds = (block.Relationships ?? [])
      .filter((r) => r.Type === "VALUE")
      .flatMap((r) => r.Ids ?? []);
    const valueBlock = valueIds.map((id) => blockById.get(id)).find(Boolean);
    if (!valueBlock) continue;

    const value = getBlockText(valueBlock);
    if (!value) continue;

    extracted[fieldKey] = { value, confidence: valueBlock.Confidence ?? 0 };
  }

  return extracted;
}

documentsRouter.post(
  "/:id/boarding-pass",
  requireAuth,
  uploadSingleImage.single("boardingPass"),
  async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await getBookingForDocuments(bookingId);

    if (booking.travelerId !== req.user!.id) {
      throw new ForbiddenError("You are not the traveler for this booking");
    }

    if (!req.file) {
      throw new BadRequestError("Boarding pass image is required");
    }

    const url = await uploadToS3({
      key: `boarding-passes/${booking.id}-${Date.now()}.${req.file.mimetype.split("/")[1]}`,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    await prisma.trip.update({ where: { id: booking.tripId }, data: { boardingPassUrl: url } });

    const extracted = await extractBoardingPassFields(req.file.buffer);

    const confidences = Object.values(extracted).map((field) => field?.confidence ?? 0);
    const minConfidence = confidences.length > 0 ? Math.min(...confidences) : 0;
    const meetsThreshold = confidences.length > 0 && minConfidence >= OCR_CONFIDENCE_THRESHOLD;

    if (meetsThreshold) {
      await prisma.trip.update({
        where: { id: booking.tripId },
        data: {
          ...(extracted.flightNumber ? { flightNumber: extracted.flightNumber.value } : {}),
          ...(extracted.departureDate ? { departureDate: new Date(extracted.departureDate.value) } : {}),
          ...(extracted.originIataCode ? { originIataCode: extracted.originIataCode.value } : {}),
          ...(extracted.destinationIataCode
            ? { destinationIataCode: extracted.destinationIataCode.value }
            : {}),
        },
      });
    } else {
      await logAuditEvent({
        entity: "Trip",
        entityId: booking.tripId,
        action: "BOARDING_PASS_OCR_LOW_CONFIDENCE",
        performedByUserId: req.user!.id,
        metadata: { extracted, minConfidence },
      });
    }

    res.json({ boardingPassUrl: url, extracted, autoApplied: meetsThreshold });
  },
);
