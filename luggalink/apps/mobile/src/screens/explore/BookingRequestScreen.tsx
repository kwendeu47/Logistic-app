import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useStripe } from "@stripe/stripe-react-native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as bookingsApi from "../../api/bookings.api";
import { getApiErrorMessage } from "../../api/client";
import * as itemsApi from "../../api/items.api";
import * as tripsApi from "../../api/trips.api";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { TextField } from "../../components/ui/TextField";
import { PriceEstimator } from "../../components/PriceEstimator";
import { WeightSlider } from "../../components/WeightSlider";
import { colors, spacing, typography } from "../../constants/theme";
import type { AppTabParamList, ExploreStackParamList } from "../../navigation/types";
import { useBookingStore } from "../../store/booking.store";
import type { ItemCategory } from "../../types";

type Props = NativeStackScreenProps<ExploreStackParamList, "BookingRequest">;

export function BookingRequestScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const upsertBooking = useBookingStore((state) => state.upsertBooking);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trips", tripId],
    queryFn: () => tripsApi.getTripById(tripId),
  });

  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [weightLbs, setWeightLbs] = useState(2);
  const [declaredValueUsd, setDeclaredValueUsd] = useState("50");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Skeleton height={24} style={styles.gap} />
          <Skeleton height={200} />
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

  const trip = data.trip;
  const canSubmit =
    itemName.trim().length > 0 &&
    recipientName.trim().length > 0 &&
    recipientAddress.trim().length > 0 &&
    recipientCountry.trim().length > 0 &&
    Number(declaredValueUsd) > 0;

  async function handlePay() {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const { itemRequest } = await itemsApi.createItemRequest({
        tripId,
        name: itemName,
        description,
        category: "OTHER" as ItemCategory,
        weightLbs,
        declaredValueUsd: Number(declaredValueUsd),
        photoUrls: [],
        recipientName,
        recipientPhone,
        recipientAddress,
        recipientCountry,
      });

      const { booking, stripeClientSecret } = await bookingsApi.createBooking({
        itemRequestId: itemRequest.id,
        tripId,
        hasInsurance,
      });

      if (!stripeClientSecret) {
        throw new Error("Payment could not be initialized for this booking.");
      }

      const initResult = await initPaymentSheet({
        paymentIntentClientSecret: stripeClientSecret,
        merchantDisplayName: "LuggaLink",
      });

      if (initResult.error) {
        throw new Error(initResult.error.message);
      }

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        throw new Error(presentResult.error.message);
      }

      upsertBooking(booking);

      Alert.alert("Booking requested", "Your payment is held in escrow until the traveler accepts.");
      const tabNavigation = navigation.getParent<NavigationProp<AppTabParamList>>();
      tabNavigation?.navigate("BookingsTab", {
        screen: "BookingDetail",
        params: { bookingId: booking.id },
      });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Request this booking</Text>

        <Text style={styles.sectionLabel}>Item details</Text>
        <TextField label="What are you sending?" value={itemName} onChangeText={setItemName} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline />
        <WeightSlider value={weightLbs} maxValue={trip.availableLbs} onChange={setWeightLbs} />
        <TextField
          label="Declared value (USD)"
          value={declaredValueUsd}
          onChangeText={setDeclaredValueUsd}
          keyboardType="numeric"
        />

        <Text style={styles.sectionLabel}>Recipient</Text>
        <TextField label="Recipient name" value={recipientName} onChangeText={setRecipientName} />
        <TextField label="Recipient phone" value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" />
        <TextField label="Recipient address" value={recipientAddress} onChangeText={setRecipientAddress} />
        <TextField label="Recipient country" value={recipientCountry} onChangeText={setRecipientCountry} />

        <Button
          label={hasInsurance ? "Insurance added ($2.00)" : "Add insurance ($2.00)"}
          variant={hasInsurance ? "primary" : "secondary"}
          onPress={() => setHasInsurance((value) => !value)}
          style={styles.insuranceButton}
        />

        <PriceEstimator
          weightLbs={weightLbs}
          pricePerLb={trip.pricePerLb}
          hasInsurance={hasInsurance}
        />

        {submitError && <Text style={styles.error}>{submitError}</Text>}

        <Button
          label="Pay and request booking"
          onPress={handlePay}
          loading={isSubmitting}
          disabled={!canSubmit}
          style={styles.payButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  gap: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  sectionLabel: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  insuranceButton: { marginVertical: spacing.md },
  error: { ...typography.small, color: colors.danger, marginVertical: spacing.md },
  payButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
