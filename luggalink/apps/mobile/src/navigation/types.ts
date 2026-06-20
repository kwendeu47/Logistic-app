import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  PhoneVerify: undefined;
};

export type ExploreStackParamList = {
  Search: undefined;
  TripDetail: { tripId: string };
  BookingRequest: { tripId: string };
};

export type MyTripsStackParamList = {
  MyTrips: undefined;
  CreateTrip: undefined;
  TripManage: { tripId: string };
};

export type BookingsStackParamList = {
  BookingsList: undefined;
  BookingDetail: { bookingId: string };
  Chat: { bookingId: string };
  QrScan: { bookingId: string; stage: "QR_SCAN_DEPARTURE" | "QR_SCAN_ARRIVAL" | "PICKUP" | "DELIVERY" };
  HandoffPhoto: {
    bookingId: string;
    purpose: "ITEM_POSTED" | "PICKUP" | "DELIVERY";
    minPhotos?: number;
  };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Kyc: undefined;
  Earnings: undefined;
  Settings: undefined;
};

export type AppTabParamList = {
  ExploreTab: NavigatorScreenParams<ExploreStackParamList>;
  MyTripsTab: NavigatorScreenParams<MyTripsStackParamList>;
  BookingsTab: NavigatorScreenParams<BookingsStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppNavigator: NavigatorScreenParams<AppTabParamList>;
};
