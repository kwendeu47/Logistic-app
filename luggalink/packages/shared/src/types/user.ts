export type UserRole = "traveler" | "sender" | "both";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
