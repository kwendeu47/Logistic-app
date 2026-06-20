import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import type { AuthStackParamList } from "../../navigation/types";
import { useAuthStore } from "../../store/auth.store";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const ROLES: { value: "SENDER" | "TRAVELER" | "BOTH"; label: string }[] = [
  { value: "SENDER", label: "I want to send items" },
  { value: "TRAVELER", label: "I want to carry items" },
  { value: "BOTH", label: "Both" },
];

export function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore((state) => state.register);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SENDER" | "TRAVELER" | "BOTH">("SENDER");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = firstName && lastName && email && password.length >= 8;

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ firstName, lastName, email: email.trim(), password, role });
      navigation.navigate("PhoneVerify");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>

          <TextField label="First name" value={firstName} onChangeText={setFirstName} />
          <TextField label="Last name" value={lastName} onChangeText={setLastName} />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
          />

          <Text style={styles.roleLabel}>I'm here to...</Text>
          <View style={styles.roleRow}>
            {ROLES.map((option) => (
              <Button
                key={option.value}
                label={option.label}
                variant={role === option.value ? "primary" : "secondary"}
                onPress={() => setRole(option.value)}
                style={styles.roleButton}
              />
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Sign up" onPress={handleSubmit} loading={isSubmitting} disabled={!canSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  roleLabel: { ...typography.small, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  roleRow: { gap: spacing.sm, marginBottom: spacing.lg },
  roleButton: { borderRadius: radii.md },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md },
});
