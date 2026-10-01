import { useAtom } from "jotai";
import { Outlet } from "react-router-dom";
import { isSearchOpenAtom } from "../atoms/search";
import useAppShortcuts from "../hooks/useAppShortcuts";
import useDocumentId from "../hooks/useDocumentId";
import Sidebar from "./sidebar/Sidebar";
import DocumentDialogs from "./DocumentDialogs";
import DocumentSwitcherOverlay from "../pages/editor/documentSwitcherOverlay/DocumentSwitcherOverlay";

/**
 * Layout route around the signed-in pages: the sidebar beside the page, the
 * app shortcuts, the ⌘K search palette and the Share / Document details
 * dialogs. As a layout route it stays mounted while the user moves between
 * these pages, so the sidebar isn't rebuilt on every navigation.
 */
const AppShell = () => {
    const [isSearchOpen, setIsSearchOpen] = useAtom(isSearchOpenAtom); // ⌘K search palette visibility
    const documentId = useDocumentId(); // document open in the editor, if any — the palette leaves it out of its list

    useAppShortcuts(); // ⌘K search and ⌘J Ask Converge

    return (
        <div className="w-screen h-screen flex flex-row overflow-x-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-x-hidden">
                <Outlet />
            </div>
            {isSearchOpen && (
                <DocumentSwitcherOverlay
                    onClose={() => setIsSearchOpen(false)}
                    documentId={documentId}
                />
            )}
            {/* Share / Document details, opened from the editor or a sidebar row */}
            <DocumentDialogs />
        </div>
    );
};

export default AppShell;
