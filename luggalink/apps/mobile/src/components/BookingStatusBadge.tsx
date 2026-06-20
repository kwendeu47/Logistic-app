import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../constants/theme";
import type { BookingStatus } from "../types";

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_TRAVELER: "Awaiting traveler",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  ACTIVE: "In transit",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<BookingStatus, { bg: string; fg: string }> = {
  PENDING_TRAVELER: { bg: "#FFF4DD", fg: "#946200" },
  ACCEPTED: { bg: colors.primaryLight, fg: colors.primaryDark },
  REJECTED: { bg: "#FBE7E7", fg: colors.danger },
  ACTIVE: { bg: "#E4EEFF", fg: "#2E5FCC" },
  COMPLETED: { bg: colors.primaryLight, fg: colors.primaryDark },
  DISPUTED: { bg: "#FBE7E7", fg: colors.danger },
  CANCELLED: { bg: colors.surface, fg: colors.textMuted },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const palette = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  text: { fontSize: 12, fontWeight: "700" },
});
