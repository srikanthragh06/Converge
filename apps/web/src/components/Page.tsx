import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";

/**
 * Full-viewport page shell shared across all top-level routes. When authRequired
 * is true, redirects to /auth if unauthenticated and shows nothing while loading.
 */
const Page = ({
    className = "",
    children,
    authRequired = false,
}: {
    className?: string;
    children?: ReactNode;
    authRequired?: boolean; // When true, blocks unauthenticated users and waits for auth to resolve.
}) => {
    const auth = useAtomValue(authAtom); // Current auth state — drives the loading and redirect logic.
    const navigate = useNavigate();

    // Redirects to /auth whenever auth resolves as unauthenticated on a protected page.
    useEffect(() => {
        if (!authRequired) return;
        if (auth.status === "unauthenticated") navigate("/auth");
    }, [auth.status, authRequired]);

    // Render nothing while auth is still resolving to avoid a flash redirect.
    if (authRequired && auth.status === "loading") return null;

    return (
        <div
            className={`w-screen h-screen flex flex-col overflow-x-hidden ${className}`}
        >
            {children}
        </div>
    );
};

export default Page;
