import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../constants/theme";
import { useBookingStore } from "../../store/booking.store";

export function OfflineBanner() {
  const isOffline = useBookingStore((state) => state.isOffline);
  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>You're offline — showing cached data. Actions will sync when reconnected.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warning, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  text: { ...typography.small, color: colors.white, textAlign: "center", fontWeight: "600" },
});
