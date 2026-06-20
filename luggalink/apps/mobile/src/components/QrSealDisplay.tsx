import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { API_BASE_URL } from "../api/client";
import { colors, radii, spacing, typography } from "../constants/theme";

interface QrSealDisplayProps {
  bookingId: string;
}

export function QrSealDisplay({ bookingId }: QrSealDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const uri = `${API_BASE_URL}/bookings/${bookingId}/qr-seal.png`;

  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onLoadEnd={() => setIsLoading(false)}
        />
        {isLoading && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
      </View>
      <Text style={styles.caption}>
        Show this seal at handoff. It is tamper-evident and tied to this booking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: spacing.md },
  imageWrapper: {
    width: 240,
    height: 240,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: 240, height: 240 },
  spinner: { position: "absolute" },
  caption: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
});
