import type { ReactNode } from "react";
import { LuSearch } from "react-icons/lu";

/**
 * Dashed notice under an add-by-email field (Share dialog, workspace Members
 * and Ownership) when the typed address can't be used: no account with that
 * email, or they already have access.
 * @param title - the notice's first line
 * @param children - the muted explanation
 */
const EmailNotice = ({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) => (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-line-strong p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-muted">
            <LuSearch className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 flex-col">
            <span className="text-sm text-fg">{title}</span>
            <span className="text-xs text-fg-muted">{children}</span>
        </div>
    </div>
);

export default EmailNotice;
