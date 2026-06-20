import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TrustBadge } from "../../components/TrustBadge";
import { Button } from "../../components/ui/Button";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuthStore } from "../../store/auth.store";
import type { ProfileStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<ProfileStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{user.firstName.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.email}>{user.email}</Text>
          <TrustBadge user={user} />
        </View>

        <View style={styles.statsCard}>
          <DetailRow label="Role" value={user.role} />
          <DetailRow label="Trips completed" value={String(user.totalTrips)} />
          <DetailRow label="Deliveries completed" value={String(user.totalDeliveries)} />
          <DetailRow label="Phone verified" value={user.isPhoneVerified ? "Yes" : "No"} />
        </View>

        <Button label="Identity verification" variant="secondary" onPress={() => navigation.navigate("Kyc")} style={styles.menuButton} />
        {(user.role === "TRAVELER" || user.role === "BOTH") && (
          <Button label="Earnings" variant="secondary" onPress={() => navigation.navigate("Earnings")} style={styles.menuButton} />
        )}
        <Button label="Settings" variant="secondary" onPress={() => navigation.navigate("Settings")} style={styles.menuButton} />
        <Button label="Log out" variant="danger" onPress={logout} style={styles.menuButton} />
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
  header: { alignItems: "center", marginBottom: spacing.lg },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 28 },
  name: { ...typography.h2, color: colors.text },
  email: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  detailLabel: { ...typography.body, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontWeight: "600" },
  menuButton: { marginBottom: spacing.md },
});
