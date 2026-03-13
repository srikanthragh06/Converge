// useAuth: checks authentication status on mount by calling GET /auth/me.
// If the JWT cookie is valid, sets isAuthedAtom and currentUserAtom.
// If the request returns 401 or fails, isAuthedAtom stays false and the
// AuthOverlay component handles prompting the user to log in.

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { axiosClient } from "../lib/axiosClient";
import { isAuthedAtom, currentUserAtom } from "../atoms/uiAtoms";
import { ApiResponse, MeData } from "../types/api";

const useAuth = () => {
    const setIsAuthed = useSetAtom(isAuthedAtom);
    const setCurrentUser = useSetAtom(currentUserAtom);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res =
                    await axiosClient.get<ApiResponse<MeData>>("/auth/me");
                const body = res.data;

                if (!body.success) return;

                setIsAuthed(true);
                setCurrentUser(body.data.user);
            } catch {
                console.error("Auth failed");
                // No existing session — AuthOverlay will prompt sign-in.
            }
        };

        checkAuth();
    }, []);
};

export default useAuth;
