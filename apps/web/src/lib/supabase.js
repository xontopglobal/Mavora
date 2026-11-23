import { createClient } from '@supabase/supabase-js';
const environment = import.meta.env || {};
const url = environment.VITE_SUPABASE_URL;
const key = environment.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key && !url.includes('YOUR_PROJECT') ? createClient(url, key) : null;
