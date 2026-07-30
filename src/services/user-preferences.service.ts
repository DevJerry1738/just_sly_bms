import { userPreferencesRepository } from "@/repositories/entity.repositories";
import type { UserPreferencesSchema } from "@/database/schema";

export async function loadUserPreferences(userId: string) {
  return userPreferencesRepository.getOrCreateForUser(userId, {});
}

export async function saveUserPreferences(userId: string, values: Partial<UserPreferencesSchema>) {
  return userPreferencesRepository.updateByUserId(userId, values);
}
