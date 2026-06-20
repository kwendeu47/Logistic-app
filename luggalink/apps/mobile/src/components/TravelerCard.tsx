import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import type { Trip } from "../types";
import { TrustBadge } from "./TrustBadge";

interface TravelerCardProps {
  trip: Trip;
  onPress: () => void;
}

export function TravelerCard({ trip, onPress }: TravelerCardProps) {
  const traveler = trip.traveler;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        {traveler?.avatarUrl ? (
          <Image source={{ uri: traveler.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{traveler?.firstName?.charAt(0) ?? "?"}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name}>
            {traveler ? `${traveler.firstName} ${traveler.lastName}` : "Traveler"}
          </Text>
          {traveler && <TrustBadge user={traveler} compact />}
        </View>
        <Text style={styles.price}>${trip.pricePerLb.toFixed(2)}/lb</Text>
      </View>

      <View style={styles.route}>
        <Text style={styles.routeText} numberOfLines={1}>
          {trip.originIataCode} → {trip.destinationIataCode}
        </Text>
        <Text style={styles.dateText}>{new Date(trip.departureDate).toLocaleDateString()}</Text>
      </View>

      <Text style={styles.capacity}>{trip.availableLbs.toFixed(1)} lbs available</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.sm },
  avatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
  headerText: { flex: 1 },
  name: { ...typography.h3, color: colors.text },
  price: { ...typography.h3, color: colors.primary },
  route: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  routeText: { ...typography.body, fontWeight: "600", color: colors.text },
  dateText: { ...typography.small, color: colors.textMuted },
  capacity: { ...typography.small, color: colors.textMuted },
});
