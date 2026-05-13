import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import AnimatedDots from "./AnimatedDots";
import { IoIosMenu } from "react-icons/io";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";

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
    const [sidebarOpen, setSidebarOpen] = useState(true); // Whether the sidebar is expanded (open) or collapsed (closed).

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
            className={`w-screen h-screen flex flex-row overflow-x-hidden ${className}`}
        >
            {/* Expanded sidebar — 500px on desktop, 200px on mobile, with a collapse button. */}
            {haveSidebar && sidebarOpen && (
                <div className="md:w-[500px] w-[200px] shrink-0 h-full border-r border-border md:p-2">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer"
                            aria-label="Close sidebar"
                        >
                            <MdKeyboardDoubleArrowLeft className="md:w-[30px] md:h-[30px] w-[20px] h-[20px]" />
                        </button>
                    </div>
                    {/* Open sidebar content */}
                </div>
            )}
            {/* Collapsed sidebar — slim column with just the hamburger open button. */}
            {haveSidebar && !sidebarOpen && (
                <div className="md:w-14 w-8 shrink-0 h-full border- border-border md:p-2">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer"
                            aria-label="Open sidebar"
                        >
                            <IoIosMenu className="md:w-[30px] md:h-[30px] w-[20px] h-[20px]" />
                        </button>
                    </div>
                    {/* Closed sidebar content */}
                </div>
            )}
            <div className="flex-1 flex flex-col overflow-x-hidden">
                {children}
            </div>
        </div>
    );
};

export default Page;
