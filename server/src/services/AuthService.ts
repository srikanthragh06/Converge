// AuthService: Supabase token verification and JWT sign/verify.
// verifyToken checks the Supabase access token via the admin client.
// signJwt / verifyJwt handle the internal JWT issued after successful Google auth.

import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/types";
import { servicesStore } from "../store/servicesStore";

export class AuthService {
    // Verifies a Supabase access token and returns the Supabase user, or null if invalid.
    async verifyToken(accessToken: string) {
        const { data, error } = await servicesStore.supabaseService.client.auth.getUser(accessToken);

        if (error || !data.user) {
            return null;
        }

        return data.user;
    }

    // Signs a JWT with the given payload and expiry. JWT_SECRET must be set in env.
    // expiresIn follows the jsonwebtoken format: "7d", "1h", "30m", etc.
    // Cast is required because jsonwebtoken's expiresIn type is a branded StringValue,
    // not a plain string, even though any valid ms-format string works at runtime.
    signJwt(payload: JwtPayload, expiresIn: string): string {
        return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: expiresIn as never });
    }

    // Verifies and decodes a JWT. Returns null if the token is invalid or expired.
    verifyJwt(token: string): JwtPayload | null {
        try {
            return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        } catch {
            return null;
        }
    }
}
