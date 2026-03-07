import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { axiosClient } from "../lib/axiosClient";

// AuthCallbackPage: handles the redirect from Google OAuth.
// Supabase exchanges the URL code for a session automatically on mount.
// Once the session is ready, the access token is sent to the backend for verification.
function AuthCallbackPage() {
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        const verifyWithBackend = async () => {
            // Supabase has already exchanged the code in the URL for a session by this point.
            const { data } = await supabase.auth.getSession();
            const accessToken = data.session?.access_token;

            if (!accessToken) {
                console.error("No access token found in session");
                return;
            }

            // Send the access token to the backend to verify and create/fetch the user.
            const res = await axiosClient.post("/auth/verify", { accessToken });
            console.log("verify response:", res.data);
            setVerified(true);
        };

        verifyWithBackend();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1f1f1f] text-zinc-400">
            {verified ? (
                <p className="text-sm text-zinc-200">Sign in successful</p>
            ) : (
                <p className="text-sm">Signing you in...</p>
            )}
        </div>
    );
}

export default AuthCallbackPage;
