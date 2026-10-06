import { getDefaultStore } from "jotai";
import { toastsAtom, type Toast } from "@/atoms/toast";

/** Increasing id for each toast shown in this session. */
let nextToastId = 1;

/**
 * Shows a toast (rendered by Toaster). A plain function rather than a hook so
 * code outside React, like the QueryClient's error handler, can call it too.
 * @param message - the text, e.g. `Restored "Computer Networks"`
 * @param options.tone - leading icon: "success" (default), "error", or "info" (none)
 * @param options.action - optional inline action, e.g. `{ label: "Open", onClick }`
 */
export const showToast = (
    message: Toast["message"],
    options: Partial<Pick<Toast, "tone" | "action">> = {},
) => {
    const toast: Toast = {
        id: nextToastId++,
        message,
        tone: options.tone ?? "success",
        action: options.action,
    };
    getDefaultStore().set(toastsAtom, (toasts) => [...toasts, toast]);
};
