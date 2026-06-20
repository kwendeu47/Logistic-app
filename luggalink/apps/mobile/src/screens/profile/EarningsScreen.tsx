import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as bookingsApi from "../../api/bookings.api";
import { useAuthStore } from "../../store/auth.store";
import type { Booking } from "../../types";

export function EarningsScreen() {
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["bookings", "me"],
    queryFn: bookingsApi.getMyBookings,
  });

  const myTravelerBookings = useMemo(
    () => (data?.bookings ?? []).filter((b) => b.travelerId === user?.id),
    [data, user],
  );

  const totalEarned = useMemo(
    () =>
      myTravelerBookings
        .filter((b) => b.status === "COMPLETED")
        .reduce((sum, b) => sum + b.travelerPayoutUsd, 0),
    [myTravelerBookings],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonList rows={4} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
        <Text style={styles.totalLabel}>Total earned</Text>
        <Text style={styles.total}>${totalEarned.toFixed(2)}</Text>
      </View>

      <FlatList
        data={myTravelerBookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }) => <EarningRow booking={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No deliveries yet.</Text>}
      />
    </SafeAreaView>
  );
}

function EarningRow({ booking }: { booking: Booking }) {
  const trip = booking.trip;
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.route} numberOfLines={1}>
          {trip ? `${trip.originIataCode} → ${trip.destinationIataCode}` : "Booking"}
        </Text>
        <BookingStatusBadge status={booking.status} />
      </View>
      <Text style={styles.payout}>${booking.travelerPayoutUsd.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  totalLabel: { ...typography.small, color: colors.textMuted },
  total: { ...typography.h1, color: colors.primary },
  list: { padding: spacing.lg, paddingTop: 0 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  route: { ...typography.body, fontWeight: "600", color: colors.text, flex: 1, marginRight: spacing.sm },
  payout: { ...typography.h3, color: colors.primary },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
