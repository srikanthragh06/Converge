import { LuLock } from "react-icons/lu";
import { cn } from "@/lib/utils";

/**
 * Notice shown above the document title while the user has locked editing on
 * this device (useWriteLock), with an Unlock action. The lock is a local
 * comfort toggle, so the banner says it only affects this device.
 * @param onUnlock - turns the write lock off
 * @param className - extra classes, e.g. margins
 */
const WriteLockBanner = ({
    onUnlock,
    className,
}: {
    onUnlock: () => void;
    className?: string;
}) => (
    <div
        role="status"
        className={cn(
            "flex min-h-9 items-center gap-2.5 rounded-lg bg-surface-selected py-1.5 pl-4 pr-1.5 text-[13px] text-fg-secondary",
            className,
        )}
    >
        <LuLock className="h-3.5 w-3.5 shrink-0 text-gold" />
        <span className="min-w-0 flex-1">
            Editing is locked on this device, so you won&apos;t change anything
            by accident.
        </span>
        <button
            type="button"
            onClick={onUnlock}
            className="shrink-0 cursor-pointer rounded-md px-2.5 py-1 font-semibold text-gold outline-none transition-colors hover:bg-gold/10 focus-visible:ring-2 focus-visible:ring-gold/60"
        >
            Unlock
        </button>
    </div>
);

export default WriteLockBanner;
