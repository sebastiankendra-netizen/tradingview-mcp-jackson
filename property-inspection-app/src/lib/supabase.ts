import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Returns a public URL for a file in the given storage bucket. */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Returns a signed URL (for private buckets like inspection-photos). */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

/** Upload any file to Supabase storage. Returns the storage path or throws. */
export async function uploadFile(
  bucket: string,
  path: string,
  uri: string,
  mimeType = 'application/octet-stream',
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;
  return path;
}

/** Upload a photo to Supabase storage. Returns the storage path or throws. */
export async function uploadPhoto(
  bucket: string,
  path: string,
  uri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  // Fetch the file from local URI and convert to ArrayBuffer
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;
  return path;
}
