import { useLocation, useNavigate } from "react-router-dom";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
    LuChevronsRight,
    LuCode,
    LuFile,
    LuKeyRound,
    LuLibrary,
    LuMoon,
    LuPin,
    LuPlus,
    LuSearch,
    LuSparkle,
    LuSun,
    LuTrash2,
} from "react-icons/lu";
import { authAtom } from "../../atoms/auth";
import { themeAtom } from "../../atoms/theme";
import { isSearchOpenAtom } from "../../atoms/search";
import useSidebar from "../../hooks/useSidebar";
import { formatShortcut } from "../../lib/utils";
import Button from "../ui/Button";
import { DropdownMenu } from "../ui/Menu";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import UserMenu from "./UserMenu";
import RailButton from "./RailButton";

/**
 * The collapsed sidebar: a narrow column of icon buttons for the same
 * destinations as the expanded panel, with tooltips. Pinned documents open
 * as a menu; the workspace tile and avatar open their usual menus to the right.
 * @param onExpand - expands the sidebar back to the full panel
 */
const SidebarRail = ({ onExpand }: { onExpand: () => void }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation(); // current route — highlights the matching button
    const auth = useAtomValue(authAtom); // signed-in user, for the avatar menu
    const user = auth.status === "authenticated" ? auth.user : null;
    const {
        workspaces,
        currentWorkspace,
        pinnedDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
    } = useSidebar(); // workspace list, pinned docs, and document creation
    const [theme, setTheme] = useAtom(themeAtom); // active color theme, flipped by the theme button
    const setIsSearchOpen = useSetAtom(isSearchOpenAtom); // opens the search palette

    return (
        <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-surface-sidebar py-3">
            <WorkspaceSwitcher
                compact
                workspaces={workspaces}
                currentWorkspace={currentWorkspace}
                onSelect={selectWorkspace}
                onOpen={refetchWorkspaces}
                onNavigate={() => {}}
            />
            <RailButton
                label="Expand sidebar"
                icon={<LuChevronsRight />}
                onClick={onExpand}
            />

            <div className="mt-3 flex flex-col items-center gap-1">
                <RailButton
                    label="Search"
                    shortcut={formatShortcut("K")}
                    icon={<LuSearch />}
                    onClick={() => setIsSearchOpen(true)}
                />
                <RailButton
                    label="New document"
                    variant="primary"
                    icon={<LuPlus />}
                    onClick={() => !isCreating && createDocument()}
                />
                <RailButton
                    label="Ask Converge"
                    shortcut={formatShortcut("J")}
                    icon={<LuSparkle />}
                    active={pathname === "/agent"}
                    onClick={() => navigate("/agent")}
                />
                <RailButton
                    label="Library"
                    icon={<LuLibrary />}
                    active={pathname === "/library"}
                    onClick={() => navigate("/library")}
                />
                {pinnedDocuments.length > 0 && (
                    <DropdownMenu
                        side="right"
                        align="start"
                        className="w-64"
                        items={[
                            {
                                type: "label",
                                label: `Pinned · ${pinnedDocuments.length}`,
                            },
                            ...pinnedDocuments.map((doc) => ({
                                label: doc.title || "Untitled",
                                icon: <LuFile />,
                                onSelect: () => navigate(`/document/${doc.id}`),
                            })),
                        ]}
                        trigger={
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Pinned documents"
                                className="data-[state=open]:bg-surface-selected"
                            >
                                <LuPin />
                            </Button>
                        }
                    />
                )}
                <RailButton
                    label={theme === "dark" ? "Light mode" : "Dark mode"}
                    icon={theme === "dark" ? <LuSun /> : <LuMoon />}
                    onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                    }
                />
            </div>

            {/* Developer links and the user, pinned to the bottom */}
            <div className="mt-auto flex flex-col items-center gap-1 pt-3">
                <RailButton
                    label="API keys"
                    icon={<LuKeyRound />}
                    active={pathname === "/api-keys"}
                    onClick={() => navigate("/api-keys")}
                />
                <RailButton
                    label="MCP setup"
                    icon={<LuCode />}
                    active={pathname === "/mcp-docs"}
                    onClick={() => navigate("/mcp-docs")}
                />
                <RailButton
                    label="Trash"
                    icon={<LuTrash2 />}
                    active={pathname === "/trash"}
                    onClick={() => navigate("/trash")}
                />
                {user && (
                    <div className="mt-2">
                        <UserMenu compact user={user} />
                    </div>
                )}
            </div>
        </aside>
    );
};

export default SidebarRail;
