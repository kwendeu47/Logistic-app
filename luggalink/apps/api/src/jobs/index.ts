import { registerDepartureReminderJob } from "./departureReminder.job";
import { registerTripAutoCancelJob } from "./tripAutoCancel.job";

export function registerJobs(): void {
  registerTripAutoCancelJob();
  registerDepartureReminderJob();
}
