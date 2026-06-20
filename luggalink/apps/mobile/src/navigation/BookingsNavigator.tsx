import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BookingsListScreen } from "../screens/bookings/BookingsListScreen";
import { BookingDetailScreen } from "../screens/bookings/BookingDetailScreen";
import { ChatScreen } from "../screens/bookings/ChatScreen";
import { QrScanScreen } from "../screens/bookings/QrScanScreen";
import { HandoffPhotoScreen } from "../screens/bookings/HandoffPhotoScreen";
import type { BookingsStackParamList } from "./types";

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BookingsList" component={BookingsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: "Booking" }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
      <Stack.Screen
        name="QrScan"
        component={QrScanScreen}
        options={{ title: "Scan QR seal", headerShown: false }}
      />
      <Stack.Screen name="HandoffPhoto" component={HandoffPhotoScreen} options={{ title: "Handoff photos" }} />
    </Stack.Navigator>
  );
}
