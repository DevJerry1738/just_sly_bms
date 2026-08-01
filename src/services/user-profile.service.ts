import { supabase } from "@/integrations/supabase/client";
import { userPreferencesRepository, userProfileRepository } from "@/repositories/entity.repositories";
import type { UserPreferencesSchema, UserProfileSchema } from "@/database/schema";

const AVATAR_BUCKET = "avatars";

async function compressImage(file: File, maxWidth = 600, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create canvas context for image compression.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Image compression failed."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

export async function loadUserProfile(userId: string, initialValues: Partial<UserProfileSchema>) {
  return userProfileRepository.getOrCreateForUser(userId, initialValues);
}

export async function saveUserProfile(userId: string, values: Partial<UserProfileSchema>) {
  return userProfileRepository.updateByUserId(userId, values);
}

export async function loadUserPreferences(userId: string) {
  return userPreferencesRepository.getOrCreateForUser(userId, {});
}

export async function saveUserPreferences(userId: string, values: Partial<UserPreferencesSchema>) {
  return userPreferencesRepository.updateByUserId(userId, values);
}

export async function uploadAvatar(userId: string, file: File) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const previewUrl = URL.createObjectURL(file);
    return userProfileRepository.updateByUserId(userId, {
      avatarUrl: previewUrl,
      avatarFileName: file.name,
      avatarUpdatedAt: Date.now(),
    });
  }

  const compressed = await compressImage(file);
  const storagePath = `user-${userId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(storagePath, compressed, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) {
    throw new Error("Unable to generate avatar public URL.");
  }

  return userProfileRepository.updateByUserId(userId, {
    avatarUrl: publicUrl,
    avatarFileName: file.name,
    avatarUpdatedAt: Date.now(),
  });
}

export async function removeAvatar(userId: string) {
  return userProfileRepository.updateByUserId(userId, {
    avatarUrl: null,
    avatarFileName: null,
    avatarUpdatedAt: Date.now(),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Password changes require an active internet connection.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;

  return true;
}
