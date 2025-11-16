import { env } from '@/env';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

    // 在本地仅前端模式下，如果没有配置 Supabase，就直接跳过会话同步。
    if (!supabaseUrl || !supabaseAnonKey) {
        return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                supabaseResponse = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options),
                );
            },
        },
    });

    await supabase.auth.getUser();
    return supabaseResponse;
}
