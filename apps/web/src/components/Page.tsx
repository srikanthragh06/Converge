import { type ReactNode, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { LuMenu } from "react-icons/lu";
import { authAtom } from "../atoms/auth";
import { isSearchOpenAtom } from "../atoms/search";
import { mobileSidebarOpenAtom } from "../atoms/sidebar";
import Button from "./ui/Button";
import useAppShortcuts from "../hooks/useAppShortcuts";
import AuthStatus from "./auth/AuthStatus";
import Sidebar from "./sidebar/Sidebar";
import DelayedRender from "./DelayedRender";
import DocumentDialogs from "./DocumentDialogs";
import DocumentSwitcherOverlay from "../pages/editor/documentSwitcherOverlay/DocumentSwitcherOverlay";

/**
 * Full-viewport page shell shared across all top-level routes. When authRequired
 * is true, shows an authenticating screen while loading and redirects to /auth if unauthenticated.
 * When haveSidebar is true, renders a sidebar alongside the page content (on
 * phones: a top bar whose menu button opens the sidebar drawer, unless the
 * page draws its own), and enables the app shortcuts and the ⌘K search
 * palette they open.
 */
const Page = ({
    className = "",
    children,
    authRequired = false,
    haveSidebar = false,
    mobileTitle,
    mobileTopBar = true,
}: {
    className?: string;
    children?: ReactNode;
    authRequired?: boolean; // When true, blocks unauthenticated users and waits for auth to resolve.
    haveSidebar?: boolean; // When true, renders a sidebar alongside the page content.
    mobileTitle?: string; // Page name shown in the phone top bar beside the menu button, e.g. "Library".
    mobileTopBar?: boolean; // When false, skips the phone top bar — for a page that renders its own (e.g. the editor).
}) => {
    const auth = useAtomValue(authAtom); // Current auth state — drives the loading and redirect logic.
    const navigate = useNavigate();
    const [isSearchOpen, setIsSearchOpen] = useAtom(isSearchOpenAtom); // ⌘K search palette visibility
    const { documentId } = useParams(); // document open in the editor, if any — the palette leaves it out of its list
    const setIsDrawerOpen = useSetAtom(mobileSidebarOpenAtom); // opens the sidebar drawer on phones

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
                {/* Phone top bar — the sidebar lives in a drawer there */}
                {haveSidebar && mobileTopBar && (
                    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line-subtle px-2 sm:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDrawerOpen(true)}
                            aria-label="Open sidebar"
                            className="[&_svg]:h-5 [&_svg]:w-5"
                        >
                            <LuMenu />
                        </Button>
                        {mobileTitle && (
                            <span className="truncate text-[15px] font-semibold text-fg">
                                {mobileTitle}
                            </span>
                        )}
                    </header>
                )}
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
