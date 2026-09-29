import type { ComponentProps, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LuX } from "react-icons/lu";
import { cn } from "../../lib/utils";

/** Max width of a Modal panel. */
export type ModalSize = "sm" | "md" | "lg" | "xl";

/** Panel max width per size: confirmations, forms, settings, and wide split views. */
const SIZE_CLASSES: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-5xl",
};

/**
 * Centered dialog over a dimmed backdrop: serif title, optional subtitle,
 * and a close button. Focus is trapped inside while open and returns to the
 * trigger on close; Escape and a backdrop click close it. Built on Radix
 * Dialog, so a nested Modal stacks correctly above its parent.
 * @param open - whether the modal is shown (default true, for modals that
 *               are mounted only while open)
 * @param onClose - called on Escape, backdrop click, or the close button
 * @param title - serif heading; also the dialog's accessible name
 * @param description - muted line under the title, e.g. "Changes apply immediately."
 * @param titleAside - content next to the title, e.g. the document name in Version history
 * @param headerActions - buttons shown before the close button, e.g. "Save checkpoint now"
 * @param size - panel max width (default "sm")
 * @param dismissible - when false, Escape and backdrop clicks are ignored, e.g. while a request is in flight
 * @param className - extra panel classes, e.g. a width or a fixed height
 * @param bodyClassName - extra body classes, e.g. "p-0 sm:p-0" for a split view that runs edge to edge
 * @param children - the modal body; place a ModalFooter last for the button row
 */
const Modal = ({
    open = true,
    onClose,
    title,
    description,
    titleAside,
    headerActions,
    size = "sm",
    dismissible = true,
    className,
    bodyClassName,
    children,
}: {
    open?: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    titleAside?: ReactNode;
    headerActions?: ReactNode;
    size?: ModalSize;
    dismissible?: boolean;
    className?: string;
    bodyClassName?: string;
    children?: ReactNode;
}) => (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay" />
            <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
                <DialogPrimitive.Content
                    // Without a description Radix warns unless aria-describedby is explicitly unset.
                    {...(description ? {} : { "aria-describedby": undefined })}
                    onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
                    onPointerDownOutside={(e) =>
                        !dismissible && e.preventDefault()
                    }
                    className={cn(
                        "pointer-events-auto flex max-h-full w-full animate-modal-in flex-col overflow-hidden rounded-xl border border-line bg-surface-elevated text-fg shadow-2xl shadow-shadow outline-none",
                        SIZE_CLASSES[size],
                        className,
                    )}
                >
                    <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex min-w-0 items-baseline gap-3">
                                <DialogPrimitive.Title className="truncate font-serif text-xl font-medium leading-tight text-fg sm:text-2xl">
                                    {title}
                                </DialogPrimitive.Title>
                                {titleAside && (
                                    <span className="truncate text-sm text-fg-muted">
                                        {titleAside}
                                    </span>
                                )}
                            </div>
                            {description && (
                                <DialogPrimitive.Description className="text-sm text-fg-muted">
                                    {description}
                                </DialogPrimitive.Description>
                            )}
                        </div>
                        {headerActions}
                        <DialogPrimitive.Close
                            aria-label="Close"
                            className="-mr-1.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-gold/60"
                        >
                            <LuX className="h-4 w-4" />
                        </DialogPrimitive.Close>
                    </div>
                    <div
                        className={cn(
                            "flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6",
                            bodyClassName,
                        )}
                    >
                        {children}
                    </div>
                </DialogPrimitive.Content>
            </div>
        </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
);

/**
 * Right-aligned button row at the bottom of a Modal body.
 * @param className - extra classes, e.g. `justify-between` to push a button to the left
 */
export const ModalFooter = ({ className, ...rest }: ComponentProps<"div">) => (
    <div
        className={cn("mt-5 flex items-center justify-end gap-2", className)}
        {...rest}
    />
);

export default Modal;
