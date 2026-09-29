import { useAtom } from "jotai";
import { sidebarCollapsedAtom } from "../../atoms/sidebar";
import SidebarPanel from "./SidebarPanel";
import SidebarRail from "./SidebarRail";

/**
 * The app's left sidebar: the full panel, or the icon rail when the user has
 * collapsed it. The choice is remembered across pages and visits.
 */
const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useAtom(sidebarCollapsedAtom); // whether the rail is shown instead of the panel

    return isCollapsed ? (
        <SidebarRail onExpand={() => setIsCollapsed(false)} />
    ) : (
        <SidebarPanel onCollapse={() => setIsCollapsed(true)} />
    );
};

export default Sidebar;
