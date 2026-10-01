import type { ReactNode } from "react";

/**
 * Read-only access label in the Share dialog, in place of a dropdown, e.g.
 * the owner's "Owner" or a level the caller may not change.
 * @param icon - optional leading icon, e.g. a lock for the owner
 * @param children - the label
 */
const ReadOnlyAccess = ({
    icon,
    children,
}: {
    icon?: ReactNode;
    children: ReactNode;
}) => (
    <span className="flex shrink-0 items-center gap-1.5 px-3 text-sm text-fg-secondary [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {children}
    </span>
);

export default ReadOnlyAccess;
