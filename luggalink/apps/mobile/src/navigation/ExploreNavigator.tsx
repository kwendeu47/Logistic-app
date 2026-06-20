import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SearchScreen } from "../screens/explore/SearchScreen";
import { TripDetailScreen } from "../screens/explore/TripDetailScreen";
import { BookingRequestScreen } from "../screens/explore/BookingRequestScreen";
import type { ExploreStackParamList } from "./types";

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export function ExploreNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: "Trip details" }} />
      <Stack.Screen name="BookingRequest" component={BookingRequestScreen} options={{ title: "Request booking" }} />
    </Stack.Navigator>
  );
}
