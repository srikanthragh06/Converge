import { useAtom } from "jotai";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { LuCheck, LuCircleAlert } from "react-icons/lu";
import { toastsAtom } from "../../atoms/toast";

/** How long a toast stays on screen, in ms. Hovering or focusing it pauses the timer. */
const TOAST_DURATION_MS = 5000;

/**
 * Renders the toasts queued via useToast as inverted chips stacked at the
 * bottom center of the screen, above modals. Radix Toast announces each one
 * to screen readers and supports swipe-down and Escape to dismiss. Mount
 * once, at the app root.
 */
const Toaster = () => {
    const [toasts, setToasts] = useAtom(toastsAtom); // on-screen toasts; each removes itself when closed

    return (
        <ToastPrimitive.Provider
            duration={TOAST_DURATION_MS}
            swipeDirection="down"
        >
            {toasts.map((toast) => (
                <ToastPrimitive.Root
                    key={toast.id}
                    onOpenChange={(open) =>
                        !open &&
                        setToasts((all) => all.filter((t) => t.id !== toast.id))
                    }
                    className="flex animate-modal-in items-center gap-3 rounded-lg bg-tooltip px-4 py-2.5 text-sm text-tooltip-fg shadow-lg shadow-shadow data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=end]:hidden"
                >
                    {toast.tone === "success" && (
                        <LuCheck className="h-4 w-4 shrink-0" />
                    )}
                    {toast.tone === "error" && (
                        // No red: the chip is inverted, so no danger token contrasts in both themes.
                        <LuCircleAlert className="h-4 w-4 shrink-0" />
                    )}
                    <ToastPrimitive.Description className="min-w-0 flex-1">
                        {toast.message}
                    </ToastPrimitive.Description>
                    {toast.action && (
                        <ToastPrimitive.Action
                            altText={toast.action.label}
                            onClick={toast.action.onClick}
                            className="ml-4 shrink-0 cursor-pointer rounded font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold/60"
                        >
                            {toast.action.label}
                        </ToastPrimitive.Action>
                    )}
                </ToastPrimitive.Root>
            ))}
            <ToastPrimitive.Viewport className="fixed bottom-4 left-1/2 z-[70] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 outline-none sm:bottom-6" />
        </ToastPrimitive.Provider>
    );
};

export default Toaster;
