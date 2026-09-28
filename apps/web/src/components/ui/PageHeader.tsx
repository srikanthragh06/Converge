import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";
import Button from "./Button";

/** The primary call to action in a PageHeader, e.g. "New document". */
export type PageAction = {
    label: string;
    /** Shown before the label, and alone on phones. */
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
};

/**
 * Centered content column for a top-level page (Library, Trash, Workspaces,
 * API keys, MCP setup), with the page's standard width and padding.
 */
export const PageContainer = ({ className, ...rest }: ComponentProps<"div">) => (
    <div
        className={cn(
            "mx-auto flex w-full max-w-[58rem] flex-col px-4 pb-16 pt-6 sm:px-8 sm:pt-12",
            className,
        )}
        {...rest}
    />
);

/**
 * Top of a page: serif H1 with a muted subtitle on the left, the primary
 * action on the right, and optional content (usually a filter Input) below.
 * On phones the subtitle is hidden and the action shrinks to its icon.
 * @param title - the page name, e.g. "Library"
 * @param description - one line under the title, e.g. "Every document you can open in X's workspace."
 * @param action - the gold primary button, e.g. New document
 * @param children - content under the header row, e.g. a filter Input
 */
export const PageHeader = ({
    title,
    description,
    action,
    children,
}: {
    title: ReactNode;
    description?: ReactNode;
    action?: PageAction;
    children?: ReactNode;
}) => (
    <header className="mb-4 flex flex-col gap-4 sm:mb-6 sm:gap-5">
        <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
                <h1 className="truncate font-serif text-3xl font-medium leading-tight text-fg sm:text-[2.5rem]">
                    {title}
                </h1>
                {description && (
                    <p className="hidden text-sm text-fg-muted sm:block">
                        {description}
                    </p>
                )}
            </div>
            {action && (
                <>
                    <Button
                        variant="primary"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="hidden sm:inline-flex"
                    >
                        {action.icon}
                        {action.label}
                    </Button>
                    <Button
                        variant="primary"
                        size="icon"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        aria-label={action.label}
                        className="h-10 w-10 rounded-lg sm:hidden [&_svg]:h-5 [&_svg]:w-5"
                    >
                        {action.icon}
                    </Button>
                </>
            )}
        </div>
        {children}
    </header>
);
