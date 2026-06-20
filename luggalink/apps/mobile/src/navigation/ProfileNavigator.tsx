import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { KycScreen } from "../screens/profile/KycScreen";
import { EarningsScreen } from "../screens/profile/EarningsScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import type { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Kyc" component={KycScreen} options={{ title: "Identity verification" }} />
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: "Earnings" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Stack.Navigator>
  );
}
