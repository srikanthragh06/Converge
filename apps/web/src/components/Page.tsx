import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import AnimatedDots from "./AnimatedDots";
import Sidebar from "./Sidebar";

/**
 * Full-viewport page shell shared across all top-level routes. When authRequired
 * is true, shows an authenticating screen while loading and redirects to /auth if unauthenticated.
 * When haveSidebar is true, renders a sidebar alongside the page content.
 */
const Page = ({
    className = "",
    children,
    authRequired = false,
    haveSidebar = false,
}: {
    className?: string;
    children?: ReactNode;
    authRequired?: boolean; // When true, blocks unauthenticated users and waits for auth to resolve.
    haveSidebar?: boolean; // When true, renders a sidebar alongside the page content.
}) => {
    const auth = useAtomValue(authAtom); // Current auth state — drives the loading and redirect logic.
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(
        () => window.innerWidth >= 640,
    ); // Starts open on desktop (≥640px), closed on mobile — matches the sm breakpoint used in sidebar layout.

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
        <div className={`w-screen h-screen flex flex-row overflow-x-hidden`}>
            {haveSidebar && (
                <Sidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                    closeSidebar={() => setSidebarOpen(false)}
                />
            )}
            <div
                className={`flex-1 flex flex-col overflow-x-hidden ${className}`}
            >
                {children}
            </div>
        </div>
    );
};

export default Page;
