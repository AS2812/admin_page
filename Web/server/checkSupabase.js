import { supabaseAdmin } from './supabaseAdmin.js';

if (supabaseAdmin) {
  console.log('supabaseAdmin configured');
} else {
  console.log('supabaseAdmin NOT configured - missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

console.log('SUPABASE_URL envs:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
