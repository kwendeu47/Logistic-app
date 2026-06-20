import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as tripsApi from "../../api/trips.api";
import { useCamera } from "../../hooks/useCamera";
import type { MyTripsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<MyTripsStackParamList, "TripManage">;

export function TripManageScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const queryClient = useQueryClient();
  const { pickFromLibrary } = useCamera();
  const [isUploading, setIsUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trips", tripId],
    queryFn: () => tripsApi.getTripById(tripId),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Skeleton height={24} style={styles.gap} />
          <Skeleton height={120} />
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

  async function handlePublish() {
    setActionError(null);
    try {
      await tripsApi.publishTrip(tripId);
      await queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  async function handleCancel() {
    setActionError(null);
    try {
      await tripsApi.cancelTrip(tripId);
      navigation.goBack();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  async function handleUploadBoardingPass() {
    const uri = await pickFromLibrary();
    if (!uri) return;

    setIsUploading(true);
    setActionError(null);
    try {
      await tripsApi.uploadBoardingPass(tripId, uri);
      await queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
      Alert.alert("Boarding pass uploaded", "We'll auto-apply any matching flight details.");
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

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

        <View style={styles.detailsCard}>
          <DetailRow label="Status" value={trip.status} />
          <DetailRow label="Available space" value={`${trip.availableLbs.toFixed(1)} lbs`} />
          <DetailRow label="Price per lb" value={`$${trip.pricePerLb.toFixed(2)}`} />
          <DetailRow label="Boarding pass" value={trip.boardingPassUrl ? "Uploaded" : "Not uploaded"} />
        </View>

        {actionError && <Text style={styles.error}>{actionError}</Text>}

        <Button
          label="Upload boarding pass"
          variant="secondary"
          onPress={handleUploadBoardingPass}
          loading={isUploading}
          style={styles.actionButton}
        />

        {trip.status === "DRAFT" && (
          <Button label="Publish trip" onPress={handlePublish} style={styles.actionButton} />
        )}

        {trip.status !== "CANCELLED" && trip.status !== "COMPLETED" && (
          <Button label="Cancel trip" variant="danger" onPress={handleCancel} style={styles.actionButton} />
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
  route: { ...typography.h2, color: colors.text },
  dates: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  detailLabel: { ...typography.body, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontWeight: "600" },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md },
  actionButton: { marginBottom: spacing.md },
});
