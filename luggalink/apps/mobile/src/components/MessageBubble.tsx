import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import type { Message } from "../types";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.text, isOwn && styles.textOwn]}>{message.body}</Text>
        <Text style={[styles.timestamp, isOwn && styles.timestampOwn]}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: spacing.xs, paddingHorizontal: spacing.md },
  rowOwn: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: radii.md, padding: spacing.sm },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  text: { ...typography.body, color: colors.text },
  textOwn: { color: colors.white },
  timestamp: { ...typography.small, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  timestampOwn: { color: "rgba(255,255,255,0.8)" },
});
