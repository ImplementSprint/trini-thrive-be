import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('🔧 Supabase Configuration:');
console.log('  URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
console.log('  Service Role Key:', supabaseServiceKey ? '✓ Set (length: ' + supabaseServiceKey.length + ')' : '✗ Missing');
console.log('  Anon Key:', supabaseAnonKey ? '✓ Set (length: ' + supabaseAnonKey.length + ')' : '✗ Missing');

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL in environment variables - check backend/.env");
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in environment variables - check backend/.env");
}

// Use service role key for backend operations (bypasses RLS), fall back to anon key
const key = supabaseServiceKey || supabaseAnonKey!;
console.log('  Using key type:', supabaseServiceKey ? 'Service Role' : 'Anon');

export const supabase = createClient(supabaseUrl, key);
export const supabaseServer = supabase;
console.log('✅ Supabase client initialized successfully');
