import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as tripsApi from "../../api/trips.api";
import type { MyTripsStackParamList } from "../../navigation/types";
import type { Trip } from "../../types";

type Props = NativeStackScreenProps<MyTripsStackParamList, "MyTrips">;

export function MyTripsScreen({ navigation }: Props) {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["trips", "me"],
    queryFn: tripsApi.getMyTrips,
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My trips</Text>
        <Button label="New trip" onPress={() => navigation.navigate("CreateTrip")} style={styles.newButton} />
      </View>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.trips ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TripRow trip={item} onPress={() => navigation.navigate("TripManage", { tripId: item.id })} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>You haven't created any trips yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.route}>
        {trip.originIataCode} → {trip.destinationIataCode}
      </Text>
      <Text style={styles.meta}>
        {new Date(trip.departureDate).toLocaleDateString()} · {trip.availableLbs.toFixed(1)} lbs · {trip.status}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  newButton: { marginBottom: spacing.xs },
  list: { padding: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  route: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
