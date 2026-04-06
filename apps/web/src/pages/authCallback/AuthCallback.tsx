import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const AuthCallbackPage = () => {
    const [searchParams] = useSearchParams();
    const state = searchParams.get("state");
    const code = searchParams.get("code");

    const [authStatus, setAuthStatus] = useState<
        "PENDING" | "FAILED" | "SUCCESSFUL"
    >("PENDING");

    useEffect(() => {
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
            console.error("Auth callback CSRF state mismatch — possible CSRF attack.");
            setAuthStatus("FAILED");
            return;
        }

        // State is single-use — remove it now that it has been validated.
        localStorage.removeItem("authCSRFState");

        setAuthStatus("SUCCESSFUL");
    }, [code, state]);

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center">
            {authStatus === "PENDING" && <div>Signing you in...</div>}
            {authStatus === "FAILED" && <div>Sign in failed :(</div>}
            {authStatus === "SUCCESSFUL" && <div>Sign in successful</div>}
        </div>
    );
};

export default AuthCallbackPage;
