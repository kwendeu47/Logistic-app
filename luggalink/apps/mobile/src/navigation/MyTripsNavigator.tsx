import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MyTripsScreen } from "../screens/mytrips/MyTripsScreen";
import { CreateTripScreen } from "../screens/mytrips/CreateTripScreen";
import { TripManageScreen } from "../screens/mytrips/TripManageScreen";
import type { MyTripsStackParamList } from "./types";

const Stack = createNativeStackNavigator<MyTripsStackParamList>();

export function MyTripsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MyTrips" component={MyTripsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateTrip" component={CreateTripScreen} options={{ title: "New trip" }} />
      <Stack.Screen name="TripManage" component={TripManageScreen} options={{ title: "Manage trip" }} />
    </Stack.Navigator>
  );
}
