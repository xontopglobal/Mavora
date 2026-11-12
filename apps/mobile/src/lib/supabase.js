
import { createClient } from '@supabase/supabase-js';

// Expo inlines EXPO_PUBLIC_* values into the client bundle. These values are
// public by design; privileged Supabase keys must remain on the API server.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasPublicConfig = Boolean(
  url && anonKey && !url.includes('YOUR_PROJECT') && !anonKey.includes('YOUR_SUPABASE')
);

export const supabase =
  hasPublicConfig
    ? createClient(url, anonKey)
    : null;
