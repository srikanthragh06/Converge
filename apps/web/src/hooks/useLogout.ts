import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { authAtom } from "../atoms/auth";
import apiClient from "../lib/http";

/**
 * Returns a logout function that calls POST /auth/logout to clear the
 * server-side httpOnly cookie, resets the auth atom to unauthenticated,
 * and redirects the user to the root route.
 */
const useLogout = () => {
    const setAuth = useSetAtom(authAtom); // writes the cleared auth state after logout
    const navigate = useNavigate(); // redirects to / after the session is ended

    /**
     * Calls the logout endpoint, clears client auth state, and navigates away.
     * Proceeds with local cleanup even if the server call fails, so the user
     * is never left stuck in a partially-authenticated state.
     */
    const logout = async () => {
        try {
            await apiClient.post("/auth/logout");
        } finally {
            // Always clear local state regardless of server response.
            setAuth({ status: "unauthenticated", user: null });
            navigate("/");
        }
    };

    return logout;
};

export default useLogout;
