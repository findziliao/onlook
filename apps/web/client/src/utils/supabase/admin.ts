import { env } from '@/env';
import { createClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client with service role key
 * This client has full access to the database and can bypass RLS policies
 * Use with extreme caution and only in admin procedures
 */
export const createAdminClient = () => {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};
