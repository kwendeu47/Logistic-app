import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { colors, spacing, typography } from "../../constants/theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>LuggaLink</Text>
        <Text style={styles.tagline}>Ship anything, anywhere — carried by travelers you trust.</Text>
      </View>

      <View style={styles.actions}>
        <Button label="Log in" onPress={() => navigation.navigate("Login")} />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => navigation.navigate("Register")}
          style={styles.secondaryButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "space-between", padding: spacing.lg },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { ...typography.h1, color: colors.primary, marginBottom: spacing.sm },
  tagline: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg },
  actions: { paddingBottom: spacing.lg },
  secondaryButton: { marginTop: spacing.sm },
});
