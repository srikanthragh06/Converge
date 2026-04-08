import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../lib/http";
import type { GoogleAuthDto } from "@converge/shared";

const useGoogleAuthCallback = () => {
    const navigate = useNavigate();
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

                await apiClient.post("/auth/google", {
                    code,
                } satisfies GoogleAuthDto);

                setAuthStatus("SUCCESSFUL");
            } catch (err) {
                setAuthStatus("FAILED");
                console.error(err);
            }
        };

        handleAuth();
    }, []);

    useEffect(() => {
        if (authStatus !== "SUCCESSFUL") return;

        // Delay navigation so the success message is briefly visible.
        const timer = setTimeout(() => navigate("/"), 1200);
        return () => clearTimeout(timer);
    }, [authStatus, navigate]);

    return { authStatus };
};

export default useGoogleAuthCallback;
