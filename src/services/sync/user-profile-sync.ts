import { SyncManager } from "./sync-manager";
import { supabase } from "@/integrations/supabase/client";

const remoteTable = {
  profiles: "user_profiles",
  preferences: "user_preferences",
};

const toRemotePayload = (payload: Record<string, unknown>) => {
  const userId = payload["userId"] as string;
  return {
    ...payload,
    user_id: userId,
  };
};

SyncManager.registerHandler("user_profiles", async (operationType, payload) => {
  if (operationType !== "UPSERT") {
    return { success: false, error: "Unsupported sync operation for user_profiles." };
  }

  const { error } = await supabase.from(remoteTable.profiles).upsert(toRemotePayload(payload), { onConflict: "id" });
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("user_preferences", async (operationType, payload) => {
  if (operationType !== "UPSERT") {
    return { success: false, error: "Unsupported sync operation for user_preferences." };
  }

  const { error } = await supabase.from(remoteTable.preferences).upsert(toRemotePayload(payload), { onConflict: "id" });
  return { success: !error, error: error?.message };
});
