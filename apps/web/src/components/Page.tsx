import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import AnimatedDots from "./AnimatedDots";

/**
 * Full-viewport page shell shared across all top-level routes. When authRequired
 * is true, shows an authenticating screen while loading and redirects to /auth if unauthenticated.
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

    // Show a status message while waiting for /auth/me to resolve.
    if (authRequired && auth.status === "loading")
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center">
                <div className="text-text-secondary">
                    <span>
                        Authenticating
                        <AnimatedDots />
                    </span>
                </div>
            </div>
        );

    return (
        <div
            className={`w-screen h-screen flex flex-col overflow-x-hidden ${className}`}
        >
            {children}
        </div>
    );
};

export default Page;
