import { Expo } from "expo-server-sdk";
import { Router } from "express";

export const expoReceiptWebhookRouter = Router();

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

/**
 * Expo doesn't push delivery receipts to us; we poll for them using ticket IDs
 * we stored when sending. This endpoint lets an internal job (or admin tool)
 * trigger that poll, and responds immediately while processing continues async
 * so the caller never has to wait on Expo's receipt API.
 */
expoReceiptWebhookRouter.post("/", (req, res) => {
  res.status(200).json({ received: true });

  const ticketIds: string[] = Array.isArray(req.body?.ticketIds) ? req.body.ticketIds : [];
  if (ticketIds.length === 0) {
    return;
  }

  void processReceiptsAsync(ticketIds);
});

async function processReceiptsAsync(ticketIds: string[]): Promise<void> {
  try {
    const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);

    for (const chunk of chunks) {
      // eslint-disable-next-line no-await-in-loop
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === "error") {
          console.error(`Expo push receipt error for ${receiptId}: ${receipt.message}`, receipt.details);
        }
      }
    }
  } catch (error) {
    console.error("Failed to process Expo push receipts", error);
  }
}
