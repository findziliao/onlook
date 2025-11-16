import { env } from '@/env';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const getFileUrlFromStorage = (bucket: string, path: string) => {
    const supabase = createClient();
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return data.publicUrl;
};

export const getFileInfoFromStorage = async (bucket: string, path: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
        .from(bucket).info(path);
    if (error) {
        console.error('Error getting file info:', error);
        return null;
    }
    return data;
};

export const uploadBlobToStorage = async (bucket: string, path: string, file: Blob, options: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
}) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, options);

    if (error) {
        console.error('Error uploading file:', error);
        return null;
    }

    return data;
};
