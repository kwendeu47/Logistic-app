import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { colors, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as tripsApi from "../../api/trips.api";
import type { MyTripsStackParamList } from "../../navigation/types";
import type { ItemCategory } from "../../types";

type Props = NativeStackScreenProps<MyTripsStackParamList, "CreateTrip">;

const ALL_CATEGORIES: ItemCategory[] = ["ELECTRONICS", "DOCUMENTS", "CLOTHING", "FOOD", "COSMETICS", "OTHER"];

export function CreateTripScreen({ navigation }: Props) {
  const [originCity, setOriginCity] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [originIataCode, setOriginIataCode] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationIataCode, setDestinationIataCode] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [availableLbs, setAvailableLbs] = useState("20");
  const [pricePerLb, setPricePerLb] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    originCity.trim().length > 0 &&
    originIataCode.trim().length > 0 &&
    destinationCity.trim().length > 0 &&
    destinationIataCode.trim().length > 0 &&
    departureDate.trim().length > 0 &&
    arrivalDate.trim().length > 0 &&
    Number(availableLbs) > 0 &&
    Number(pricePerLb) > 0;

  async function handleCreate() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { trip } = await tripsApi.createTrip({
        originCity,
        originCountry,
        originIataCode: originIataCode.toUpperCase(),
        destinationCity,
        destinationCountry,
        destinationIataCode: destinationIataCode.toUpperCase(),
        departureDate,
        arrivalDate,
        availableLbs: Number(availableLbs),
        pricePerLb: Number(pricePerLb),
        allowedCategories: ALL_CATEGORIES,
      });
      navigation.replace("TripManage", { tripId: trip.id });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create a trip</Text>

        <Text style={styles.sectionLabel}>Origin</Text>
        <TextField label="City" value={originCity} onChangeText={setOriginCity} />
        <TextField label="Country" value={originCountry} onChangeText={setOriginCountry} />
        <TextField label="Airport code (IATA)" value={originIataCode} onChangeText={setOriginIataCode} autoCapitalize="characters" maxLength={3} />

        <Text style={styles.sectionLabel}>Destination</Text>
        <TextField label="City" value={destinationCity} onChangeText={setDestinationCity} />
        <TextField label="Country" value={destinationCountry} onChangeText={setDestinationCountry} />
        <TextField label="Airport code (IATA)" value={destinationIataCode} onChangeText={setDestinationIataCode} autoCapitalize="characters" maxLength={3} />

        <Text style={styles.sectionLabel}>Flight details</Text>
        <TextField label="Departure date (YYYY-MM-DD)" value={departureDate} onChangeText={setDepartureDate} placeholder="2026-07-01" />
        <TextField label="Arrival date (YYYY-MM-DD)" value={arrivalDate} onChangeText={setArrivalDate} placeholder="2026-07-01" />

        <Text style={styles.sectionLabel}>Capacity & pricing</Text>
        <TextField label="Available space (lbs)" value={availableLbs} onChangeText={setAvailableLbs} keyboardType="numeric" />
        <TextField label="Price per lb (USD)" value={pricePerLb} onChangeText={setPricePerLb} keyboardType="numeric" />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Create trip" onPress={handleCreate} loading={isSubmitting} disabled={!canSubmit} style={styles.submitButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  sectionLabel: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  error: { ...typography.small, color: colors.danger, marginVertical: spacing.md },
  submitButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
