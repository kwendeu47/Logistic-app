import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { colors, spacing, typography } from "../../constants/theme";
import { useAuthStore } from "../../store/auth.store";

export function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <SettingRow label="Push notifications" value={pushEnabled} onChange={setPushEnabled} />
        <SettingRow label="Email notifications" value={emailEnabled} onChange={setEmailEnabled} />

        <Text style={styles.sectionLabel}>Account</Text>
        <Button label="Log out" variant="danger" onPress={logout} style={styles.logoutButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  sectionLabel: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.body, color: colors.text },
  logoutButton: { marginTop: spacing.lg },
});
