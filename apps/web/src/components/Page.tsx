import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useDocumentId from "../hooks/useDocumentId";
import { useAtom, useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import { isSearchOpenAtom } from "../atoms/search";
import useAppShortcuts from "../hooks/useAppShortcuts";
import AuthStatus from "./auth/AuthStatus";
import Sidebar from "./sidebar/Sidebar";
import DelayedRender from "./DelayedRender";
import DocumentDialogs from "./DocumentDialogs";
import DocumentSwitcherOverlay from "../pages/editor/documentSwitcherOverlay/DocumentSwitcherOverlay";

/**
 * Full-viewport page shell shared across all top-level routes. When authRequired
 * is true, shows an authenticating screen while loading and redirects to /auth if unauthenticated.
 * When haveSidebar is true, renders a sidebar alongside the page content
 * (on phones, a drawer the page's MobileTopBar opens), and enables the app
 * shortcuts and the ⌘K search palette they open.
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
    const [isSearchOpen, setIsSearchOpen] = useAtom(isSearchOpenAtom); // ⌘K search palette visibility
    const documentId = useDocumentId(); // document open in the editor, if any — the palette leaves it out of its list

    useAppShortcuts(haveSidebar); // ⌘K search and ⌘J Ask Converge, on pages with the sidebar

    // Redirects to /auth whenever auth resolves as unauthenticated on a protected page.
    useEffect(() => {
        if (!authRequired) return;
        if (auth.status === "unauthenticated") navigate("/auth");
    }, [auth.status, authRequired]);

    // Show the Authenticating screen while waiting for /auth/me to resolve.
    if (authRequired && auth.status === "loading")
        return (
            <DelayedRender>
                <AuthStatus tone="pending" title="Authenticating…" />
            </DelayedRender>
        );

    return (
        <div className={`w-screen h-screen flex flex-row overflow-x-hidden`}>
            {haveSidebar && <Sidebar />}
            <div
                className={`flex-1 flex flex-col overflow-x-hidden ${className}`}
            >
                {children}
            </div>
            {haveSidebar && isSearchOpen && (
                <DocumentSwitcherOverlay
                    onClose={() => setIsSearchOpen(false)}
                    documentId={documentId}
                />
            )}
            {/* Share / Document details, opened from the editor or a sidebar row */}
            {haveSidebar && <DocumentDialogs />}
        </div>
    );
};

export default Page;
