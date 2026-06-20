import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PhotoUploadGrid } from "../../components/PhotoUploadGrid";
import { Button } from "../../components/ui/Button";
import { colors, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as bookingsApi from "../../api/bookings.api";
import { useCamera } from "../../hooks/useCamera";
import type { BookingsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<BookingsStackParamList, "HandoffPhoto">;

const TITLES: Record<Props["route"]["params"]["purpose"], string> = {
  ITEM_POSTED: "Confirm item is ready for pickup",
  PICKUP: "Confirm pickup",
  DELIVERY: "Confirm delivery",
};

export function HandoffPhotoScreen({ route, navigation }: Props) {
  const { bookingId, purpose, minPhotos = 2 } = route.params;
  const { pickFromLibrary } = useCamera();
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [scannedQrCode, setScannedQrCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = uploadedUrls.length >= minPhotos;

  async function handleAddPhoto() {
    const uri = await pickFromLibrary();
    if (!uri) return;

    setError(null);
    try {
      const url = await bookingsApi.uploadPhoto(uri);
      setLocalUris((prev) => [...prev, uri]);
      setUploadedUrls((prev) => [...prev, url]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  function handleRemovePhoto(index: number) {
    setLocalUris((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (purpose === "ITEM_POSTED") {
        await bookingsApi.reportItemPosted(bookingId, { trackingNumber, photoUrls: uploadedUrls });
      } else if (purpose === "PICKUP") {
        await bookingsApi.confirmPickup(bookingId, { photoUrls: uploadedUrls, scannedQrCode });
      } else {
        await bookingsApi.confirmDelivery(bookingId, {
          photoUrls: uploadedUrls,
          scannedQrCode,
          recipientSignature: "",
        });
      }
      navigation.navigate("BookingDetail", { bookingId });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{TITLES[purpose]}</Text>
        <Text style={styles.subtitle}>Add at least {minPhotos} photos before continuing.</Text>

        <PhotoUploadGrid
          photos={localUris}
          minPhotos={minPhotos}
          onAddPhoto={handleAddPhoto}
          onRemovePhoto={handleRemovePhoto}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          label="Submit"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
          style={styles.submitButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textMuted, marginBottom: spacing.lg },
  error: { ...typography.small, color: colors.danger, marginVertical: spacing.md },
  submitButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
