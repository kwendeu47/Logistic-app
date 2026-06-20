import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../constants/theme";
import type { User } from "../types";

interface TrustBadgeProps {
  user: Pick<User, "isIdVerified" | "isFaceVerified" | "trustScore">;
  compact?: boolean;
}

export function TrustBadge({ user, compact }: TrustBadgeProps) {
  return (
    <View style={styles.row}>
      <View style={styles.ratingPill}>
        <Text style={styles.ratingText}>★ {user.trustScore.toFixed(1)}</Text>
      </View>
      {user.isIdVerified && (
        <View style={[styles.pill, styles.verifiedPill]}>
          <Text style={styles.pillText}>ID verified</Text>
        </View>
      )}
      {user.isFaceVerified && !compact && (
        <View style={[styles.pill, styles.verifiedPill]}>
          <Text style={styles.pillText}>Face verified</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  ratingPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  verifiedPill: { backgroundColor: colors.primaryLight },
  pillText: { color: colors.primaryDark, fontSize: 11, fontWeight: "600" },
});
