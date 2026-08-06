import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://hpkfsuvxafcctdmkooup.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_pj1JvuR1OhzTpQgipH5AsQ_apaIw7uZ";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
