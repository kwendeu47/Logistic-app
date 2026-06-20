export const MIN_BOOKING_WEIGHT_KG = 0.5;
export const MAX_BOOKING_WEIGHT_KG = 30;
export const PLATFORM_FEE_PERCENT = 10;
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "KES"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
