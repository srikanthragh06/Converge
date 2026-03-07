// useAuth: checks authentication status on mount by calling GET /auth/me.
// If the JWT cookie is valid, sets isAuthedAtom and currentUserAtom.
// If the request returns 401 or fails, navigates to /auth (skipped if already there).

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { axiosClient } from "../lib/axiosClient";
import { isAuthedAtom, currentUserAtom } from "../atoms/uiAtoms";
import { ApiResponse, MeData } from "../types/api";

const useAuth = () => {
    const navigate = useNavigate();
    const setIsAuthed = useSetAtom(isAuthedAtom);
    const setCurrentUser = useSetAtom(currentUserAtom);

    useEffect(() => {
        // Auth pages — redirect is skipped when already on one of these paths.
        const authPaths = ["/auth", "/auth/callback"];

        // Navigates to /auth unless the current path is already an auth page.
        const redirectToAuth = () => {
            const currentPath = window.location.pathname;
            const isAuthPath = authPaths.some((p) => currentPath.startsWith(p));
            if (!isAuthPath) {
                navigate("/auth", { replace: true });
            }
        };

        const checkAuth = async () => {
            try {
                const res = await axiosClient.get<ApiResponse<MeData>>("/auth/me");
                const body = res.data;

                if (!body.success) {
                    redirectToAuth();
                    return;
                }

                setIsAuthed(true);
                setCurrentUser(body.data.user);
            } catch {
                redirectToAuth();
            }
        };

        checkAuth();
    }, []);
};

export default useAuth;
