import Queue from "bull";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const tripAutoCancelQueue = new Queue("trip-auto-cancel", REDIS_URL);
export const departureReminderQueue = new Queue("departure-reminder", REDIS_URL);
