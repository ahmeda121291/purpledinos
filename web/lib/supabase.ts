import { createClient } from "@supabase/supabase-js";

// Public, read-only access. The anon key is meant to be public; row-level security
// only allows reads on display tables.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://mhphrklhfkvlecaeyaox.supabase.co";
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_b1wE_4Tv0JUPKiKfi96nGw_1L-Pf9WI";

export const db = createClient(url, anon, { auth: { persistSession: false } });
