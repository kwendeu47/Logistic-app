import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../constants/theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = "primary", disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, VARIANT_STYLES[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.label, variant === "secondary" && styles.labelSecondary]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const VARIANT_STYLES = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight },
  danger: { backgroundColor: colors.danger },
});

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  label: { ...typography.body, fontWeight: "700", color: colors.white },
  labelSecondary: { color: colors.primaryDark },
});
