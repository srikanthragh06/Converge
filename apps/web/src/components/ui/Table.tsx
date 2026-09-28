import type { ComponentProps, CSSProperties } from "react";
import { cn } from "../../lib/utils";

/**
 * List-style table (Library, Trash, Workspaces, API keys) laid out as a CSS
 * grid rather than a <table>, so a hovered row can be one rounded block.
 * Every TableHeader and TableRow inside shares the column template set here.
 * @param columns - CSS grid-template-columns, e.g. "minmax(0,1fr) 7rem 7rem 4rem"
 * @param mobileColumns - template below the sm breakpoint, where cells marked
 *                        hideOnMobile are dropped (defaults to `columns`)
 */
export const Table = ({
    columns,
    mobileColumns,
    className,
    style,
    ...rest
}: {
    columns: string;
    mobileColumns?: string;
} & ComponentProps<"div">) => (
    <div
        role="table"
        className={cn("flex w-full flex-col", className)}
        style={
            {
                "--table-cols": columns,
                "--table-cols-mobile": mobileColumns ?? columns,
                ...style,
            } as CSSProperties
        }
        {...rest}
    />
);

/** Grid classes shared by the header and every row. */
const GRID_CLASSES =
    "grid grid-cols-[var(--table-cols-mobile)] items-center gap-x-3 px-3 sm:grid-cols-[var(--table-cols)] sm:gap-x-4";

/** The muted column-label row at the top of a Table. Children are TableHeadCells. */
export const TableHeader = ({ className, ...rest }: ComponentProps<"div">) => (
    <div
        role="row"
        className={cn(
            GRID_CLASSES,
            "relative py-2 text-xs text-fg-muted after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-line-subtle",
            className,
        )}
        {...rest}
    />
);

/**
 * One column label in a TableHeader.
 * @param hideOnMobile - drops the label below the sm breakpoint; match it on the column's cells
 */
export const TableHeadCell = ({
    hideOnMobile,
    className,
    ...rest
}: { hideOnMobile?: boolean } & ComponentProps<"div">) => (
    <div
        role="columnheader"
        className={cn("truncate", hideOnMobile && "hidden sm:block", className)}
        {...rest}
    />
);

/**
 * One body row. Rows are divided by inset lines; on hover the row fills with
 * a rounded background and the lines on both sides of it hide. Clickable when
 * onClick is set — give the row a link or button inside as well, so it is
 * reachable by keyboard.
 */
export const TableRow = ({
    className,
    onClick,
    ...rest
}: ComponentProps<"div">) => (
    <div
        role="row"
        onClick={onClick}
        className={cn(
            GRID_CLASSES,
            // Separator drawn as a pseudo-element so it can be inset and hidden on hover.
            "group/row relative min-h-12 rounded-lg py-2 text-sm text-fg-secondary transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-line-subtle hover:bg-surface-hover hover:after:opacity-0 [&:has(+*:hover)]:after:opacity-0",
            onClick && "cursor-pointer",
            className,
        )}
        {...rest}
    />
);

/**
 * One cell in a TableRow. Content is truncated rather than wrapped.
 * @param hideOnMobile - drops the cell below the sm breakpoint (pair with Table's mobileColumns)
 */
export const TableCell = ({
    hideOnMobile,
    className,
    ...rest
}: { hideOnMobile?: boolean } & ComponentProps<"div">) => (
    <div
        role="cell"
        className={cn(
            "flex min-w-0 items-center gap-2.5",
            hideOnMobile && "hidden sm:flex",
            className,
        )}
        {...rest}
    />
);

/**
 * Trailing row buttons (pin, ⋯, Restore, ...), hidden until the row is
 * hovered or focused. They stay visible while a menu opened from them is open,
 * and always show on touch screens, which have no hover. Clicks inside do not
 * reach the row's onClick.
 */
export const RowActions = ({ className, ...rest }: ComponentProps<"div">) => (
    <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
            "flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100",
            className,
        )}
        {...rest}
    />
);
