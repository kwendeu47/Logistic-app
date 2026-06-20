import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { TrustBadge } from "../../components/TrustBadge";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as tripsApi from "../../api/trips.api";
import type { ExploreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<ExploreStackParamList, "TripDetail">;

export function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trips", tripId],
    queryFn: () => tripsApi.getTripById(tripId),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Skeleton height={28} style={styles.skeletonGap} />
          <Skeleton height={80} style={styles.skeletonGap} />
          <Skeleton height={140} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const { trip } = data;
  const traveler = trip.traveler;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.route}>
          {trip.originCity} ({trip.originIataCode}) → {trip.destinationCity} ({trip.destinationIataCode})
        </Text>
        <Text style={styles.dates}>
          Departs {new Date(trip.departureDate).toLocaleDateString()} · Arrives{" "}
          {new Date(trip.arrivalDate).toLocaleDateString()}
        </Text>

        {traveler && (
          <View style={styles.travelerCard}>
            <Text style={styles.travelerName}>
              {traveler.firstName} {traveler.lastName}
            </Text>
            <TrustBadge user={traveler} />
            <Text style={styles.travelerStats}>
              {traveler.totalTrips} trips completed · {traveler.totalDeliveries} deliveries
            </Text>
          </View>
        )}

        <View style={styles.detailsCard}>
          <DetailRow label="Available space" value={`${trip.availableLbs.toFixed(1)} lbs`} />
          <DetailRow label="Price per lb" value={`$${trip.pricePerLb.toFixed(2)}`} />
          <DetailRow label="Allowed categories" value={trip.allowedCategories.join(", ")} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Request this trip" onPress={() => navigation.navigate("BookingRequest", { tripId })} />
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  skeletonGap: { marginBottom: spacing.md },
  route: { ...typography.h2, color: colors.text },
  dates: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  travelerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  travelerName: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  travelerStats: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  detailsCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  detailLabel: { ...typography.body, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontWeight: "600" },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
});
