import { supabase } from './supabase';

/**
 * Notifications are disabled in Expo Go (expo-notifications requires a
 * custom development build). All functions are safe no-ops here.
 * Re-enable with a proper EAS build.
 */

export function initNotifications() {
  // no-op in Expo Go
}

export async function registerForPushNotifications(): Promise<string | null> {
  return null;
}

export async function savePushToken(userId: string, token: string) {
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data,
  });
}
