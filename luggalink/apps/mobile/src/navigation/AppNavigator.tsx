import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { ExploreNavigator } from "./ExploreNavigator";
import { MyTripsNavigator } from "./MyTripsNavigator";
import { BookingsNavigator } from "./BookingsNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { colors } from "../constants/theme";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const TAB_ICONS: Record<keyof AppTabParamList, string> = {
  ExploreTab: "🔎",
  MyTripsTab: "🧳",
  BookingsTab: "📦",
  ProfileTab: "👤",
};

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: () => <Text>{TAB_ICONS[route.name as keyof AppTabParamList]}</Text>,
      })}
    >
      <Tab.Screen name="ExploreTab" component={ExploreNavigator} options={{ title: "Explore" }} />
      <Tab.Screen name="MyTripsTab" component={MyTripsNavigator} options={{ title: "My trips" }} />
      <Tab.Screen name="BookingsTab" component={BookingsNavigator} options={{ title: "Bookings" }} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
