import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TravelerCard } from "../../components/TravelerCard";
import { ErrorState } from "../../components/ui/ErrorState";
import { OfflineBanner } from "../../components/ui/OfflineBanner";
import { SkeletonList } from "../../components/ui/Skeleton";
import { colors, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as tripsApi from "../../api/trips.api";
import type { ExploreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<ExploreStackParamList, "Search">;

export function SearchScreen({ navigation }: Props) {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["trips", "search"],
    queryFn: () => tripsApi.searchTrips({}),
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <OfflineBanner />
      <View style={styles.header}>
        <Text style={styles.title}>Find a traveler</Text>
        <Text style={styles.subtitle}>Browse upcoming trips with available space.</Text>
      </View>

      {isLoading ? (
        <SkeletonList rows={5} />
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
            <TravelerCard trip={item} onPress={() => navigation.navigate("TripDetail", { tripId: item.id })} />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No trips found yet. Check back soon.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  list: { padding: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
