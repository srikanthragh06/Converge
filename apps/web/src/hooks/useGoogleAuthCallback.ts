import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../lib/http";
import {
    type AuthResponseDto,
    type GoogleAuthRequestDto,
} from "@converge/shared";
import { AUTH_CSRF_STATE } from "../constants/constants";
import { useSetAtom } from "jotai";
import { authAtom } from "../atoms/auth";

/**
 * Handles the Google OAuth callback by validating the CSRF state token,
 * exchanging the authorisation code with the server, and navigating to the
 * app on success. Exposes `authStatus` to drive UI feedback.
 *
 * @returns `authStatus` — the current stage of the auth flow: PENDING, SUCCESSFUL, or FAILED.
 */
const useGoogleAuthCallback = () => {
    const navigate = useNavigate(); // Used to redirect to the app on successful login.
    const [searchParams] = useSearchParams(); // Reads `code` and `state` from the Google redirect URL.
    const state = searchParams.get("state"); // The CSRF state token echoed back by Google.
    const code = searchParams.get("code"); // The one-time authorisation code from Google.

    const setAuth = useSetAtom(authAtom); // Updates global auth state on login success or failure.

    const [authStatus, setAuthStatus] = useState<
        "PENDING" | "FAILED" | "SUCCESSFUL"
    >("PENDING"); // Tracks the current stage of the OAuth exchange to drive UI feedback.

    // Runs once on mount — validates the CSRF state and exchanges the code with the server.
    useEffect(() => {
        const handleAuth = async () => {
            try {
                setAuthStatus("PENDING");

                if (!code) {
                    throw new Error("Auth callback missing code parameter.");
                }
                if (!state) {
                    throw new Error("Auth callback missing state parameter.");
                }

                const origState = localStorage.getItem(AUTH_CSRF_STATE);
                if (!origState || origState !== state) {
                    throw new Error("Auth callback CSRF state mismatch — possible CSRF attack.");
                }

                // State is single-use — remove it now that it has been validated.
                localStorage.removeItem(AUTH_CSRF_STATE);

                const { data: userDetails } =
                    await apiClient.post<AuthResponseDto>(
                        "/auth/google",
                        { code } satisfies GoogleAuthRequestDto,
                    );

                setAuth({ status: "authenticated", user: userDetails });
                setAuthStatus("SUCCESSFUL");
            } catch (err) {
                console.error(err);
                setAuth({ status: "unauthenticated", user: null });
                setAuthStatus("FAILED");
            }
        };

        handleAuth();
    }, []);

    // Navigates to the app after a short delay once auth succeeds, so the
    // success message is briefly visible before the redirect.
    useEffect(() => {
        if (authStatus !== "SUCCESSFUL") return;

        // Delay navigation so the success message is briefly visible.
        const timer = setTimeout(() => navigate("/"), 1200);
        return () => clearTimeout(timer);
    }, [authStatus, navigate]);

    return { authStatus };
};

export default useGoogleAuthCallback;
