import type { ReactNode } from "react";

/**
 * One label / value row of the Document details list, with a separator below.
 * @param label - muted label on the left, e.g. "Owner"
 * @param children - the value
 */
const DetailRow = ({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) => (
    <div className="flex items-center gap-4 border-b border-line py-3 text-sm">
        <dt className="w-28 shrink-0 text-fg-muted sm:w-40">{label}</dt>
        <dd className="min-w-0 flex-1 truncate text-fg">{children}</dd>
    </div>
);

export default DetailRow;
