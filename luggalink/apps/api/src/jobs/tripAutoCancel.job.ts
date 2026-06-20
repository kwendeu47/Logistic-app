import { tripAutoCancelQueue } from "../config/queue";
import { prisma } from "../config/prisma";

const RUN_EVERY_MS = 15 * 60 * 1000;
const JOB_ID = "trip-auto-cancel";

export function registerTripAutoCancelJob(): void {
  tripAutoCancelQueue.process(async () => {
    const result = await prisma.trip.updateMany({
      where: { status: "ACTIVE", departureDate: { lt: new Date() } },
      data: { status: "CANCELLED" },
    });
    return { cancelledCount: result.count };
  });

  void tripAutoCancelQueue.add({}, { repeat: { every: RUN_EVERY_MS }, jobId: JOB_ID });
}
