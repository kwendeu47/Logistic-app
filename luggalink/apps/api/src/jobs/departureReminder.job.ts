import { departureReminderQueue } from "../config/queue";
import { prisma } from "../config/prisma";
import { sendPushNotification } from "../utils/push";

const REMINDER_WINDOW_HOURS = 48;
const RUN_EVERY_CRON = "0 * * * *";
const JOB_ID = "departure-reminder";
const PENDING_BOOKING_STATUSES = ["PENDING_TRAVELER", "ACCEPTED", "ACTIVE"] as const;

export function registerDepartureReminderJob(): void {
  departureReminderQueue.process(async () => {
    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    const trips = await prisma.trip.findMany({
      where: {
        status: "ACTIVE",
        departureDate: { gte: windowStart, lte: windowEnd },
        bookings: { some: { status: { in: [...PENDING_BOOKING_STATUSES] } } },
      },
      include: { traveler: true, bookings: true },
    });

    for (const trip of trips) {
      const pendingCount = trip.bookings.filter((booking) =>
        PENDING_BOOKING_STATUSES.includes(booking.status as (typeof PENDING_BOOKING_STATUSES)[number]),
      ).length;

      await sendPushNotification({
        user: trip.traveler,
        title: "Departure reminder",
        body: `Your trip to ${trip.destinationCity} departs in less than ${REMINDER_WINDOW_HOURS} hours. You have ${pendingCount} pending booking(s).`,
        data: { tripId: trip.id },
      });
    }

    return { remindersSent: trips.length };
  });

  void departureReminderQueue.add({}, { repeat: { cron: RUN_EVERY_CRON }, jobId: JOB_ID });
}
