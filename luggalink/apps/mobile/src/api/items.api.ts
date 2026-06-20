import { apiClient } from "./client";
import type { ItemCategory, ItemRequest } from "../types";

export interface CreateItemRequestInput {
  tripId: string;
  name: string;
  description: string;
  category: ItemCategory;
  weightLbs: number;
  declaredValueUsd: number;
  photoUrls: string[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCountry: string;
}

export async function createItemRequest(input: CreateItemRequestInput): Promise<{ itemRequest: ItemRequest }> {
  const { data } = await apiClient.post<{ itemRequest: ItemRequest }>("/item-requests", input);
  return data;
}
