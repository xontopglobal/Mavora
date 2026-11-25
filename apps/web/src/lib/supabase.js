import { createClient } from '@supabase/supabase-js';

const cleanEnvValue = value => String(value || '').trim().replace(/^(["'])(.*)\1$/, '$2').trim();
const url = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '');
const key = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

const isPlaceholder = value =>
  !value || /YOUR_PROJECT|YOUR_SUPABASE|REPLACE_ME|PLACEHOLDER/i.test(value);

let urlValid = false;
try {
  const parsedUrl = new URL(url);
  urlValid = ['https:', 'http:'].includes(parsedUrl.protocol) && Boolean(parsedUrl.host);
} catch {
  // Keep invalid or missing environment URLs from reaching createClient.
}

export const supabaseConfigStatus = {
  configured: Boolean(url && key && !isPlaceholder(url) && !isPlaceholder(key) && urlValid),
  urlConfigured: Boolean(url && !isPlaceholder(url)),
  keyConfigured: Boolean(key && !isPlaceholder(key)),
  urlValid
};

export const supabase = supabaseConfigStatus.configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
