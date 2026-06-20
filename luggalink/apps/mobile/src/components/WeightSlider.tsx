import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

interface WeightSliderProps {
  value: number;
  minValue?: number;
  maxValue?: number;
  onChange: (value: number) => void;
}

export function WeightSlider({ value, minValue = 0.5, maxValue = 30, onChange }: WeightSliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Item weight</Text>
        <Text style={styles.value}>{value.toFixed(1)} lbs</Text>
      </View>
      <Slider
        minimumValue={minValue}
        maximumValue={maxValue}
        step={0.5}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
      <View style={styles.boundsRow}>
        <Text style={styles.boundsText}>{minValue} lbs</Text>
        <Text style={styles.boundsText}>{maxValue} lbs</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: spacing.sm },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  label: { ...typography.body, color: colors.text },
  value: { ...typography.body, fontWeight: "700", color: colors.primary },
  boundsRow: { flexDirection: "row", justifyContent: "space-between" },
  boundsText: { ...typography.small, color: colors.textMuted },
});
