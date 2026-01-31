import { createClient } from '@supabase/supabase-js';
// O SvelteKit usa este import especial para variáveis públicas
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Se as variáveis não existirem, o SvelteKit vai te avisar no erro de build
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);