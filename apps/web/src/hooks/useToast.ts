import { showToast } from "@/lib/toast";

/**
 * Returns showToast, which pops a short notification at the bottom of the
 * screen (rendered by Toaster). Toasts close on their own after a few seconds.
 */
const useToast = () => ({ showToast });

export default useToast;
