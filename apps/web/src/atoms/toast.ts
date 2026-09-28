import { atom } from "jotai";
import type { ReactNode } from "react";

/** Leading icon of a toast: a check for success, a warning mark for errors, or none. */
export type ToastTone = "success" | "error" | "info";

/** One toast notification. */
export type Toast = {
    /** Unique id, used to remove the toast once it closes. */
    id: number;
    /** The message, e.g. `Restored "Computer Networks"`. */
    message: ReactNode;
    tone: ToastTone;
    /** Optional inline action, e.g. Open. Choosing it also closes the toast. */
    action?: { label: string; onClick: () => void };
};

/** Toasts currently on screen, oldest first. Rendered by Toaster; added via useToast. */
export const toastsAtom = atom<Toast[]>([]);
