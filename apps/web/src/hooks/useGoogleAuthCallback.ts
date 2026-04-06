import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const useGoogleAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const state = searchParams.get("state");
    const code = searchParams.get("code");

    const [authCallbackStatus, setAuthCallbackStatus] = useState<
        "PENDING" | "FAILED" | "SUCCESSFUL"
    >("PENDING");

    useEffect(() => {
        setAuthCallbackStatus("PENDING");

        if (!code) {
            console.error("Auth callback missing code parameter.");
            setAuthCallbackStatus("FAILED");
            return;
        }
        if (!state) {
            console.error("Auth callback missing state parameter.");
            setAuthCallbackStatus("FAILED");
            return;
        }

        const origState = localStorage.getItem("authCSRFState");
        if (!origState || origState !== state) {
            console.error(
                "Auth callback CSRF state mismatch — possible CSRF attack.",
            );
            setAuthCallbackStatus("FAILED");
            return;
        }

        // State is single-use — remove it now that it has been validated.
        localStorage.removeItem("authCSRFState");

        setAuthCallbackStatus("SUCCESSFUL");
    }, [code, state]);

    return { authCallbackStatus };
};

export default useGoogleAuthCallback;
