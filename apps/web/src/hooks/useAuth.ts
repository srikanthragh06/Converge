import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { authAtom } from "../atoms/auth";
import apiClient from "../lib/http";
import { type AuthResponseDto } from "@converge/shared";

/**
 * Hydrates the auth atom on app load by calling GET /auth/me.
 * Sets status to authenticated with user data on success, or unauthenticated on 401.
 * Called once at the app root so all pages share the resolved auth state.
 */
const useAuth = () => {
    const setAuth = useSetAtom(authAtom); // Writes auth state after /auth/me resolves.

    // Calls /auth/me once on mount to determine whether the session cookie is still valid.
    useEffect(() => {
        const hydrate = async () => {
            try {
                const { data: user } =
                    await apiClient.get<AuthResponseDto>("/auth/me");
                setAuth({ status: "authenticated", user });
            } catch {
                setAuth({ status: "unauthenticated", user: null });
            }
        };

        hydrate();
    }, []);
};

export default useAuth;
