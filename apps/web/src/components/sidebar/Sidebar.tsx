import { useAtom } from "jotai";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
    mobileSidebarOpenAtom,
    sidebarCollapsedAtom,
} from "../../atoms/sidebar";
import useIsMobile from "../../hooks/useIsMobile";
import useSeedWorkspace from "../../hooks/useSeedWorkspace";
import SidebarPanel from "./SidebarPanel";
import SidebarRail from "./SidebarRail";

/**
 * The app's left sidebar. On desktop: the full panel, or the icon rail when
 * the user has collapsed it (remembered across pages and visits). On phones:
 * the panel as a drawer that slides over the page, opened from the top bar's
 * menu button and closed by a nav choice, the collapse button, Escape, or a
 * tap on the dimmed page.
 */
const Sidebar = () => {
    useSeedWorkspace(); // here, so the workspace is set even while the phone drawer is closed
    const isMobile = useIsMobile(); // phones get the drawer instead of an inline sidebar
    const [isCollapsed, setIsCollapsed] = useAtom(sidebarCollapsedAtom); // desktop: whether the rail is shown instead of the panel
    const [isDrawerOpen, setIsDrawerOpen] = useAtom(mobileSidebarOpenAtom); // phones: whether the drawer is open

    if (isMobile)
        return (
            <DialogPrimitive.Root
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
            >
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay" />
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        className="fixed inset-y-0 left-0 z-[60] flex w-[82vw] max-w-[320px] animate-drawer-in shadow-2xl shadow-shadow outline-none"
                    >
                        <DialogPrimitive.Title className="sr-only">
                            Navigation
                        </DialogPrimitive.Title>
                        <SidebarPanel
                            onCollapse={() => setIsDrawerOpen(false)}
                        />
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        );

    return isCollapsed ? (
        <SidebarRail onExpand={() => setIsCollapsed(false)} />
    ) : (
        <SidebarPanel onCollapse={() => setIsCollapsed(true)} />
    );
};

export default Sidebar;
