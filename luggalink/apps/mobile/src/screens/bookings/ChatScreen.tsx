import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageBubble } from "../../components/MessageBubble";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { colors, spacing } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as messagesApi from "../../api/messages.api";
import { useBookingSocket } from "../../hooks/useBookingSocket";
import { useAuthStore } from "../../store/auth.store";
import { useBookingStore } from "../../store/booking.store";
import type { BookingsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<BookingsStackParamList, "Chat">;

export function ChatScreen({ route }: Props) {
  const { bookingId } = route.params;
  const user = useAuthStore((state) => state.user);
  const setMessages = useBookingStore((state) => state.setMessages);
  const messages = useBookingStore((state) => state.messagesByBooking[bookingId] ?? []);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useBookingSocket({ bookingId });

  const { isLoading, isError, error, refetch } = useQuery({
    queryKey: ["messages", bookingId],
    queryFn: () => messagesApi.getMessages(bookingId),
  });

  useEffect(() => {
    refetch().then((result) => {
      if (result.data) setMessages(bookingId, result.data.messages);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;

    setIsSending(true);
    setSendError(null);
    try {
      const { message } = await messagesApi.sendMessage(bookingId, body);
      useBookingStore.getState().appendMessage(bookingId, message);
      setDraft("");
    } catch (err) {
      setSendError(getApiErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading && messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonList rows={6} />
      </SafeAreaView>
    );
  }

  if (isError && messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MessageBubble message={item} isOwn={item.senderId === user?.id} />}
        />

        <View style={styles.inputRow}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message"
            style={styles.input}
          />
          <Button label="Send" onPress={handleSend} loading={isSending} disabled={!draft.trim()} style={styles.sendButton} />
        </View>
        {sendError && <ErrorState message={sendError} onRetry={handleSend} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { paddingVertical: spacing.md },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  input: { flex: 1, marginBottom: 0 },
  sendButton: { paddingHorizontal: spacing.md },
});
