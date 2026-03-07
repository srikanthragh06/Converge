// SupabaseService: owns the Supabase admin client instance.
// Uses the service role key so it can verify any user token server-side.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export class SupabaseService {
    public readonly client: SupabaseClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}
