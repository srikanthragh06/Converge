import type { ReactNode } from "react";
import { LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/utils";

/**
 * A collapsible group of sidebar rows (Pinned, Recent) under a small
 * uppercase header with a chevron and an optional count.
 * @param title - header text, e.g. "Pinned"
 * @param count - number shown at the header's right edge
 * @param isOpen - whether the rows are shown
 * @param onToggle - flips isOpen; called when the header is clicked
 * @param children - the section's rows
 */
const SidebarSection = ({
    title,
    count,
    isOpen,
    onToggle,
    children,
}: {
    title: string;
    count?: number;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
}) => (
    <section className="flex flex-col">
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted outline-none transition-colors hover:text-fg-secondary focus-visible:ring-2 focus-visible:ring-gold/60"
        >
            <LuChevronDown
                className={cn(
                    "h-3 w-3 shrink-0 transition-transform",
                    !isOpen && "-rotate-90",
                )}
            />
            <span className="flex-1 text-left">{title}</span>
            {count !== undefined && (
                <span className="tabular-nums">{count}</span>
            )}
        </button>
        {isOpen && <div className="flex flex-col gap-px">{children}</div>}
    </section>
);

export default SidebarSection;
