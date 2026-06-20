import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { colors, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as authApi from "../../api/auth.api";
import { useAuthStore } from "../../store/auth.store";

export function PhoneVerifyScreen() {
  const setUser = useAuthStore((state) => state.setUser);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleVerify() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { user } = await authApi.verifyPhone(otp);
      setUser(user);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code we sent you.</Text>

        <TextField
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          style={styles.otpInput}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Verify" onPress={handleVerify} loading={isSubmitting} disabled={otp.length !== 6} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  otpInput: { textAlign: "center", fontSize: 24, letterSpacing: 8 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md },
});
