import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { HandoffTimeline } from "../../components/HandoffTimeline";
import { QrSealDisplay } from "../../components/QrSealDisplay";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as bookingsApi from "../../api/bookings.api";
import { useBookingSocket } from "../../hooks/useBookingSocket";
import { useAuthStore } from "../../store/auth.store";
import { useBookingStore } from "../../store/booking.store";
import type { BookingsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<BookingsStackParamList, "BookingDetail">;

export function BookingDetailScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const queryClient = useQueryClient();
  const upsertBooking = useBookingStore((state) => state.upsertBooking);
  const user = useAuthStore((state) => state.user);
  const [actionError, setActionError] = useState<string | null>(null);

  useBookingSocket({ bookingId });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bookings", bookingId],
    queryFn: () => bookingsApi.getBookingById(bookingId),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Skeleton height={24} style={styles.gap} />
          <Skeleton height={160} />
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

  const { booking } = data;
  const trip = booking.trip;
  const isTraveler = user?.id === booking.travelerId;

  async function refresh() {
    const result = await refetch();
    if (result.data) upsertBooking(result.data.booking);
  }

  async function handleAccept() {
    setActionError(null);
    try {
      await bookingsApi.acceptBooking(bookingId);
      await refresh();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  async function handleReject() {
    setActionError(null);
    try {
      await bookingsApi.rejectBooking(bookingId);
      await refresh();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.route}>
            {trip ? `${trip.originIataCode} → ${trip.destinationIataCode}` : "Booking"}
          </Text>
          <BookingStatusBadge status={booking.status} />
        </View>

        <View style={styles.detailsCard}>
          <DetailRow label="Total price" value={`$${booking.totalPriceUsd.toFixed(2)}`} />
          <DetailRow label="Traveler payout" value={`$${booking.travelerPayoutUsd.toFixed(2)}`} />
          <DetailRow label="Insurance" value={booking.hasInsurance ? `$${booking.insuranceFeeUsd.toFixed(2)}` : "None"} />
          <DetailRow label="Escrow" value={booking.escrowStatus} />
        </View>

        {booking.status === "PENDING_TRAVELER" && isTraveler && (
          <View style={styles.actionsRow}>
            <Button label="Accept" onPress={handleAccept} style={styles.actionButton} />
            <Button label="Reject" variant="danger" onPress={handleReject} style={styles.actionButton} />
          </View>
        )}

        {actionError && <Text style={styles.error}>{actionError}</Text>}

        <Text style={styles.sectionLabel}>Handoff progress</Text>
        <HandoffTimeline logs={booking.handoffLogs ?? []} />

        {booking.status === "ACCEPTED" || booking.status === "ACTIVE" ? (
          <QrSealDisplay bookingId={booking.id} />
        ) : null}

        <Button
          label="Open chat"
          variant="secondary"
          onPress={() => navigation.navigate("Chat", { bookingId })}
          style={styles.actionButton}
        />

        {!isTraveler && booking.status === "ACCEPTED" && (
          <Button
            label="Mark item posted"
            onPress={() =>
              navigation.navigate("HandoffPhoto", { bookingId, purpose: "ITEM_POSTED", minPhotos: 2 })
            }
            style={styles.actionButton}
          />
        )}

        {isTraveler && booking.status === "ACCEPTED" && (
          <Button
            label="Confirm pickup"
            onPress={() => navigation.navigate("HandoffPhoto", { bookingId, purpose: "PICKUP", minPhotos: 2 })}
            style={styles.actionButton}
          />
        )}

        {isTraveler && booking.status === "ACTIVE" && (
          <Button
            label="Scan departure QR"
            onPress={() => navigation.navigate("QrScan", { bookingId, stage: "QR_SCAN_DEPARTURE" })}
            style={styles.actionButton}
          />
        )}
      </ScrollView>
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
  gap: { marginBottom: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  route: { ...typography.h2, color: colors.text, flex: 1, marginRight: spacing.sm },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  detailLabel: { ...typography.body, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  actionButton: { flex: 1, marginBottom: spacing.md },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md },
  sectionLabel: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
});
