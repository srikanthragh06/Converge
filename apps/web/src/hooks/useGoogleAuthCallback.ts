import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const useGoogleAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const state = searchParams.get("state");
    const code = searchParams.get("code");

    const [authStatus, setAuthStatus] = useState<
        "PENDING" | "FAILED" | "SUCCESSFUL"
    >("PENDING");

    useEffect(() => {
        const handleAuth = async () => {
            try {
                setAuthStatus("PENDING");

                if (!code) {
                    console.error("Auth callback missing code parameter.");
                    setAuthStatus("FAILED");
                    return;
                }
                if (!state) {
                    console.error("Auth callback missing state parameter.");
                    setAuthStatus("FAILED");
                    return;
                }

                const origState = localStorage.getItem("authCSRFState");
                if (!origState || origState !== state) {
                    console.error(
                        "Auth callback CSRF state mismatch — possible CSRF attack.",
                    );
                    setAuthStatus("FAILED");
                    return;
                }

                // State is single-use — remove it now that it has been validated.
                localStorage.removeItem("authCSRFState");

                setAuthStatus("SUCCESSFUL");
            } catch (err) {
                setAuthStatus("FAILED");
                console.error(err);
            }
        };

        handleAuth();
    }, []);

    return { authStatus };
};

export default useGoogleAuthCallback;
