import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { supabase } from "../../lib/supabase";
import { axiosClient } from "../../lib/axiosClient";
import { isAuthedAtom, currentUserAtom } from "../../atoms/uiAtoms";
import { ApiResponse, VerifyGoogleAuthData } from "../../types/api";
import AnimatedDots from "../../components/style/AnimatedDots";

// AuthCallbackPage: handles the redirect from Google OAuth.
// Supabase exchanges the URL code for a session automatically on mount.
// Once the session is ready, the access token is sent to the backend to:
//   1. Verify it with Supabase admin client
//   2. Upsert the user in the DB
//   3. Issue an httpOnly JWT cookie
// On success, navigates back to the page the user came from (?from= param),
// falling back to /library if no origin page was specified.
function AuthCallbackPage() {
    const navigate = useNavigate();
    const setIsAuthed = useSetAtom(isAuthedAtom);
    const setCurrentUser = useSetAtom(currentUserAtom);
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const from =
            new URLSearchParams(window.location.search).get("from") ??
            "/library";

        const verifyWithBackend = async () => {
            // Supabase has already exchanged the code in the URL for a session by this point.
            const { data } = await supabase.auth.getSession();
            const accessToken = data.session?.access_token;

            if (!accessToken) {
                setError("No access token found in session");
                return;
            }

            // Send the access token to the backend — backend sets the JWT cookie in the response.
            const res = await axiosClient.post<
                ApiResponse<VerifyGoogleAuthData>
            >("/auth/verifyGoogleAuth", { accessToken });
            const body = res.data;

            if (!body.success) {
                setError(body.error);
                return;
            }

            // Set auth atoms so the overlay is dismissed immediately on navigation.
            setIsAuthed(true);
            setCurrentUser(body.data.user);
            setVerified(true);

            // Brief pause so the user sees the success state before navigating back.
            setTimeout(() => navigate(from, { replace: true }), 1200);
        };

        verifyWithBackend();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1f1f1f] text-zinc-400">
            {error ? (
                <p className="text-sm text-red-400">{error}</p>
            ) : verified ? (
                <p className="text-sm text-zinc-200">Sign in successful</p>
            ) : (
                <p className="text-sm">
                    Signing you in
                    <AnimatedDots />
                </p>
            )}
        </div>
    );
}

export default AuthCallbackPage;
