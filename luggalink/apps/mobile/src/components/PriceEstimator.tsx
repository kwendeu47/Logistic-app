import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";

interface PriceEstimatorProps {
  weightLbs: number;
  pricePerLb: number;
  hasInsurance?: boolean;
  insuranceFeeUsd?: number;
  platformFeeRate?: number;
  currency?: string;
  conversionRate?: number;
}

export function PriceEstimator({
  weightLbs,
  pricePerLb,
  hasInsurance = false,
  insuranceFeeUsd = 2,
  platformFeeRate = 0.1,
  currency = "USD",
  conversionRate = 1,
}: PriceEstimatorProps) {
  const subtotal = weightLbs * pricePerLb;
  const platformFee = subtotal * platformFeeRate;
  const insurance = hasInsurance ? insuranceFeeUsd : 0;
  const total = subtotal + insurance;
  const travelerPayout = subtotal - platformFee;

  const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;
  const convertedTotal = total * conversionRate;

  return (
    <View style={styles.container}>
      <Row label={`Shipping (${weightLbs.toFixed(1)} lbs × $${pricePerLb.toFixed(2)})`} value={formatUsd(subtotal)} />
      {hasInsurance && <Row label="Insurance" value={formatUsd(insurance)} />}
      <Row label="Platform fee" value={formatUsd(platformFee)} muted />
      <Row label="Traveler payout" value={formatUsd(travelerPayout)} muted />
      <View style={styles.divider} />
      <Row label="Total due" value={formatUsd(total)} bold />
      {currency !== "USD" && (
        <Text style={styles.conversionHint}>
          ≈ {currency} {convertedTotal.toFixed(2)} at today's rate (charged in USD)
        </Text>
      )}
    </View>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, muted && styles.muted, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, muted && styles.muted, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  label: { ...typography.small, color: colors.text },
  value: { ...typography.small, color: colors.text },
  muted: { color: colors.textMuted },
  bold: { fontWeight: "700", fontSize: 16, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  conversionHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
});
