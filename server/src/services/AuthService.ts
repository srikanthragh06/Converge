// AuthService: Supabase auth operations.
// Gets the Supabase client from SupabaseService via servicesStore.

import { servicesStore } from "../store/servicesStore";

export class AuthService {
    // Verifies a Supabase access token and returns the user, or null if invalid.
    async verifyToken(accessToken: string) {
        const { data, error } = await servicesStore.supabaseService.client.auth.getUser(accessToken);

        if (error || !data.user) {
            return null;
        }

        return data.user;
    }
}
