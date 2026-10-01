import type { ReactNode } from "react";

/**
 * One label / value pair in the General tab's details card, e.g.
 * "Type" over "Team workspace".
 * @param label - the muted label
 * @param children - the value
 */
const DetailItem = ({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) => (
    <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className="truncate text-sm text-fg">{children}</span>
    </div>
);

export default DetailItem;
