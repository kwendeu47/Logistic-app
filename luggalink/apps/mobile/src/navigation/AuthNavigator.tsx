import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { PhoneVerifyScreen } from "../screens/auth/PhoneVerifyScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: "Log in" }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: "Create account" }} />
      <Stack.Screen
        name="PhoneVerify"
        component={PhoneVerifyScreen}
        options={{ headerShown: true, title: "Verify phone" }}
      />
    </Stack.Navigator>
  );
}
