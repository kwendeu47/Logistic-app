import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { ErrorState } from "../../components/ui/ErrorState";
import { OfflineBanner } from "../../components/ui/OfflineBanner";
import { SkeletonList } from "../../components/ui/Skeleton";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as bookingsApi from "../../api/bookings.api";
import { useBookingStore } from "../../store/booking.store";
import type { BookingsStackParamList } from "../../navigation/types";
import type { Booking } from "../../types";

type Props = NativeStackScreenProps<BookingsStackParamList, "BookingsList">;

export function BookingsListScreen({ navigation }: Props) {
  const setBookings = useBookingStore((state) => state.setBookings);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["bookings", "me"],
    queryFn: async () => {
      const result = await bookingsApi.getMyBookings();
      setBookings(result.bookings);
      return result;
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <OfflineBanner />
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.bookings ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <BookingRow booking={item} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No bookings yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function BookingRow({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const trip = booking.trip;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.rowHeader}>
        <Text style={styles.route} numberOfLines={1}>
          {trip ? `${trip.originIataCode} → ${trip.destinationIataCode}` : "Booking"}
        </Text>
        <BookingStatusBadge status={booking.status} />
      </View>
      <Text style={styles.meta}>${booking.totalPriceUsd.toFixed(2)} total</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text },
  list: { padding: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  route: { ...typography.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  meta: { ...typography.small, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
