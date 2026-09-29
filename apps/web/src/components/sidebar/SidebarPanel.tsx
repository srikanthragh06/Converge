import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
    LuChevronsLeft,
    LuCode,
    LuExternalLink,
    LuKeyRound,
    LuLibrary,
    LuLink,
    LuMoon,
    LuPin,
    LuPinOff,
    LuPlus,
    LuSearch,
    LuSparkle,
    LuSun,
    LuTrash2,
} from "react-icons/lu";
import { authAtom } from "../../atoms/auth";
import { themeAtom } from "../../atoms/theme";
import { isSearchOpenAtom } from "../../atoms/search";
import { sidebarSectionsAtom } from "../../atoms/sidebar";
import useSidebar from "../../hooks/useSidebar";
import useDocumentMenuActions from "../../hooks/useDocumentMenuActions";
import useIsMobile from "../../hooks/useIsMobile";
import { formatShortcut } from "../../lib/utils";
import { hasAccess } from "../../utils/utils";
import type { MenuEntry } from "../ui/Menu";
import type { LibraryDocumentDto } from "@converge/shared";
import Button from "../ui/Button";
import SidebarNavItem from "./SidebarNavItem";
import SidebarSection from "./SidebarSection";
import SidebarDocumentRow from "./SidebarDocumentRow";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import UserMenu from "./UserMenu";

/**
 * The expanded sidebar (280px on desktop, filling the drawer on phones):
 * workspace switcher, primary navigation, pinned and recent documents,
 * developer links, and the signed-in user.
 * @param onCollapse - collapses the sidebar to the icon rail, or closes the drawer on phones
 */
const SidebarPanel = ({ onCollapse }: { onCollapse: () => void }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation(); // current route — highlights the matching nav item
    const { documentId } = useParams(); // document open in the editor, if any — highlights its row
    const auth = useAtomValue(authAtom); // signed-in user, shown in the footer
    const user = auth.status === "authenticated" ? auth.user : null;
    const {
        workspaces,
        currentWorkspace,
        recentDocuments,
        pinnedDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
        togglePin,
    } = useSidebar(); // workspace list, pinned + recent docs, and document actions
    const [theme, setTheme] = useAtom(themeAtom); // active color theme, flipped by the theme item
    const [sections, setSections] = useAtom(sidebarSectionsAtom); // which of Pinned / Recent are expanded
    const setIsSearchOpen = useSetAtom(isSearchOpenAtom); // opens the search palette
    const { openInNewTab, copyLink, moveToTrash } = useDocumentMenuActions(); // document row menu actions
    const isMobile = useIsMobile(); // on phones the panel is a drawer, closed after navigating

    /** Closes the drawer after a navigation choice on phones; the desktop sidebar stays as it is. */
    const closeOnMobile = () => {
        if (isMobile) onCollapse();
    };

    /**
     * Navigates to a route, then closes the sidebar on phones.
     * @param path - the route to open
     */
    const go = (path: string) => {
        navigate(path);
        closeOnMobile();
    };

    /**
     * The ⋯ / right-click menu of a document row. Share…, Document details,
     * and Version history join once their dialogs can open outside the editor
     * (redesign 5.5).
     * @param doc - the row's document
     * @param isPinned - whether the row is in the Pinned section
     */
    const documentMenu = (
        doc: LibraryDocumentDto,
        isPinned: boolean,
    ): MenuEntry[] => [
        {
            label: isPinned ? "Unpin from sidebar" : "Pin to sidebar",
            icon: isPinned ? <LuPinOff /> : <LuPin />,
            onSelect: () => togglePin(doc.id, !isPinned),
        },
        { type: "separator" },
        {
            label: "Open in new tab",
            icon: <LuExternalLink />,
            onSelect: () => openInNewTab(doc),
        },
        {
            label: "Copy link",
            icon: <LuLink />,
            onSelect: () => copyLink(doc),
        },
        // Trashing needs admin access; hidden rather than failing with a 403.
        ...(hasAccess(doc.access, "admin")
            ? ([
                  { type: "separator" },
                  {
                      label: "Move to Trash",
                      icon: <LuTrash2 />,
                      destructive: true,
                      onSelect: () => moveToTrash(doc),
                  },
              ] satisfies MenuEntry[])
            : []),
    ];

    return (
        <aside className="flex h-full w-full shrink-0 flex-col border-r border-line bg-surface-sidebar sm:w-[280px]">
            {/* Header — current workspace, and the button that collapses the sidebar */}
            <div className="flex items-center gap-1 px-2.5 pb-1 pt-2.5">
                <WorkspaceSwitcher
                    workspaces={workspaces}
                    currentWorkspace={currentWorkspace}
                    onSelect={selectWorkspace}
                    onOpen={refetchWorkspaces}
                    onNavigate={closeOnMobile}
                />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onCollapse}
                    aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
                >
                    <LuChevronsLeft />
                </Button>
            </div>

            {/* Primary navigation */}
            <nav className="flex flex-col gap-px px-2.5 py-2">
                <SidebarNavItem
                    icon={<LuPlus className="text-gold" />}
                    label="New document"
                    onClick={() => {
                        createDocument();
                        closeOnMobile();
                    }}
                    disabled={isCreating}
                />
                <SidebarNavItem
                    icon={<LuSparkle />}
                    label="Ask Converge"
                    shortcut={formatShortcut("J")}
                    active={pathname === "/agent"}
                    onClick={() => go("/agent")}
                />
                <SidebarNavItem
                    icon={<LuSearch />}
                    label="Search"
                    shortcut={formatShortcut("K")}
                    onClick={() => {
                        setIsSearchOpen(true);
                        closeOnMobile();
                    }}
                />
                <SidebarNavItem
                    icon={<LuLibrary />}
                    label="Library"
                    active={pathname === "/library"}
                    onClick={() => go("/library")}
                />
                {/* Labelled with the theme it switches to, as in the design */}
                <SidebarNavItem
                    icon={theme === "dark" ? <LuSun /> : <LuMoon />}
                    label={theme === "dark" ? "Light mode" : "Dark mode"}
                    onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                    }
                />
            </nav>

            {/* Pinned and recent documents — the only part that scrolls */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 pb-3 pt-2">
                {pinnedDocuments.length > 0 && (
                    <SidebarSection
                        title="Pinned"
                        count={pinnedDocuments.length}
                        isOpen={sections.pinned}
                        onToggle={() =>
                            setSections((s) => ({ ...s, pinned: !s.pinned }))
                        }
                    >
                        {pinnedDocuments.map((doc) => (
                            <SidebarDocumentRow
                                key={doc.id}
                                doc={doc}
                                isPinned
                                isActive={String(doc.id) === documentId}
                                menuItems={documentMenu(doc, true)}
                                onOpen={() => go(`/document/${doc.id}`)}
                                onTogglePin={() => togglePin(doc.id, false)}
                            />
                        ))}
                    </SidebarSection>
                )}
                <SidebarSection
                    title="Recent"
                    isOpen={sections.recent}
                    onToggle={() =>
                        setSections((s) => ({ ...s, recent: !s.recent }))
                    }
                >
                    {recentDocuments.length === 0 && (
                        <span className="px-2.5 py-1 text-xs text-fg-muted">
                            No recent documents
                        </span>
                    )}
                    {recentDocuments.map((doc) => (
                        <SidebarDocumentRow
                            key={doc.id}
                            doc={doc}
                            isPinned={false}
                            isActive={String(doc.id) === documentId}
                            menuItems={documentMenu(doc, false)}
                            onOpen={() => go(`/document/${doc.id}`)}
                            onTogglePin={() => togglePin(doc.id, true)}
                        />
                    ))}
                </SidebarSection>
            </div>

            {/* Developer links */}
            <nav className="flex flex-col gap-px border-t border-line px-2.5 py-2">
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    Developer
                </p>
                <SidebarNavItem
                    icon={<LuKeyRound />}
                    label="API keys"
                    active={pathname === "/api-keys"}
                    onClick={() => go("/api-keys")}
                />
                <SidebarNavItem
                    icon={<LuCode />}
                    label="MCP setup"
                    active={pathname === "/mcp-docs"}
                    onClick={() => go("/mcp-docs")}
                />
                <SidebarNavItem
                    icon={<LuTrash2 />}
                    label="Trash"
                    active={pathname === "/trash"}
                    onClick={() => go("/trash")}
                />
            </nav>

            {/* Signed-in user */}
            {user && (
                <div className="border-t border-line p-2.5">
                    <UserMenu user={user} />
                </div>
            )}
        </aside>
    );
};

export default SidebarPanel;
