import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { colors, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as authApi from "../../api/auth.api";
import { useAuthStore } from "../../store/auth.store";

export function KycScreen() {
  const user = useAuthStore((state) => state.user);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsLoading(true);
    setError(null);
    try {
      const { url } = await authApi.createKycSession();
      if (!url) {
        throw new Error("Verification could not be started. Please try again later.");
      }
      await Linking.openURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Identity verification</Text>
        <Text style={styles.subtitle}>
          Verify your government ID and a selfie to build trust with travelers and senders. You'll be taken
          to Stripe's secure verification flow.
        </Text>

        <View style={styles.statusCard}>
          <StatusRow label="ID verified" verified={!!user?.isIdVerified} />
          <StatusRow label="Face verified" verified={!!user?.isFaceVerified} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Start verification" onPress={handleStart} loading={isLoading} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

function StatusRow({ label, verified }: { label: string; verified: boolean }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, verified && styles.statusValueDone]}>
        {verified ? "Verified" : "Not verified"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  statusCard: { marginBottom: spacing.lg },
  statusRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  statusLabel: { ...typography.body, color: colors.text },
  statusValue: { ...typography.body, color: colors.textMuted, fontWeight: "600" },
  statusValueDone: { color: colors.primary },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md },
  button: { marginTop: spacing.md },
});
