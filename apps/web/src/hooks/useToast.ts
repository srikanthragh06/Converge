import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { toastsAtom, type Toast } from "../atoms/toast";

/** Increasing id for each toast shown in this session. */
let nextToastId = 1;

/**
 * Returns showToast, which pops a short notification at the bottom of the
 * screen (rendered by Toaster). Toasts close on their own after a few seconds.
 */
const useToast = () => {
    const setToasts = useSetAtom(toastsAtom); // the on-screen toast list

    /**
     * Shows a toast.
     * @param message - the text, e.g. `Restored "Computer Networks"`
     * @param options.tone - leading icon: "success" (default), "error", or "info" (none)
     * @param options.action - optional inline action, e.g. `{ label: "Open", onClick }`
     */
    const showToast = useCallback(
        (
            message: Toast["message"],
            options: Partial<Pick<Toast, "tone" | "action">> = {},
        ) => {
            const toast: Toast = {
                id: nextToastId++,
                message,
                tone: options.tone ?? "success",
                action: options.action,
            };
            setToasts((toasts) => [...toasts, toast]);
        },
        [setToasts],
    );

    return { showToast };
};

export default useToast;
