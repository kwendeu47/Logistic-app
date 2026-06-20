import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import type { HandoffLog, HandoffStage } from "../types";

const STAGES: { stage: HandoffStage; label: string }[] = [
  { stage: "SENDER_POSTED", label: "Item posted" },
  { stage: "TRAVELER_PICKUP", label: "Picked up by traveler" },
  { stage: "QR_SCAN_DEPARTURE", label: "Departure checkpoint" },
  { stage: "QR_SCAN_ARRIVAL", label: "Arrival checkpoint" },
  { stage: "RECIPIENT_CONFIRMED", label: "Delivered to recipient" },
];

interface HandoffTimelineProps {
  logs: HandoffLog[];
}

export function HandoffTimeline({ logs }: HandoffTimelineProps) {
  const completedStages = new Set(logs.map((log) => log.stage));

  return (
    <View>
      {STAGES.map((item, index) => {
        const isDone = completedStages.has(item.stage);
        const log = logs.find((l) => l.stage === item.stage);
        const isLast = index === STAGES.length - 1;

        return (
          <View key={item.stage} style={styles.row}>
            <View style={styles.indicatorColumn}>
              <View style={[styles.dot, isDone && styles.dotDone]}>
                {isDone && <Text style={styles.check}>✓</Text>}
              </View>
              {!isLast && <View style={[styles.line, isDone && styles.lineDone]} />}
            </View>
            <View style={styles.content}>
              <Text style={[styles.label, isDone && styles.labelDone]}>{item.label}</Text>
              {log && (
                <Text style={styles.timestamp}>{new Date(log.createdAt).toLocaleString()}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  indicatorColumn: { alignItems: "center", width: 28 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: colors.white, fontSize: 12, fontWeight: "700" },
  line: { width: 2, flex: 1, backgroundColor: colors.border, minHeight: 24 },
  lineDone: { backgroundColor: colors.primary },
  content: { flex: 1, paddingBottom: spacing.md, paddingLeft: spacing.sm },
  label: { ...typography.body, color: colors.textMuted },
  labelDone: { color: colors.text, fontWeight: "600" },
  timestamp: { ...typography.small, color: colors.textMuted, marginTop: 2 },
});
