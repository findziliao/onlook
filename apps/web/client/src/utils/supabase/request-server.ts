import { env } from '@/env';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

export async function createClient(request: NextRequest) {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
        },
    });
}
