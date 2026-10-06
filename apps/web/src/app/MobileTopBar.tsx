import { useSetAtom } from "jotai";
import { LuMenu } from "react-icons/lu";
import { mobileSidebarOpenAtom } from "@/atoms/sidebar";
import Button from "@/components/ui/Button";

/**
 * Phone-only top bar (hidden from `sm` up, where the sidebar is inline): a
 * menu button that opens the sidebar drawer, and the page's name.
 * @param title - page name shown beside the menu button, e.g. "Library"
 */
const MobileTopBar = ({ title }: { title?: string }) => {
    const setIsDrawerOpen = useSetAtom(mobileSidebarOpenAtom);

    return (
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
            {title && (
                <span className="truncate text-[15px] font-semibold text-fg">
                    {title}
                </span>
            )}
        </header>
    );
};

export default MobileTopBar;
