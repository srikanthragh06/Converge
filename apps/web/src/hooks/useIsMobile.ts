import { useSyncExternalStore } from "react";

/** Phone widths: below Tailwind's `sm` breakpoint (640px). */
const MOBILE_QUERY = "(max-width: 639px)";

/**
 * Subscribes to viewport changes across the mobile breakpoint.
 * @param onChange - called whenever the query starts or stops matching
 */
const subscribe = (onChange: () => void) => {
    const query = window.matchMedia(MOBILE_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
};

/**
 * Whether the viewport is phone-width (below Tailwind's `sm`), updating as
 * the window is resized. For layout that differs structurally on phones
 * (e.g. a drawer instead of an inline sidebar); prefer `sm:` classes when
 * only styling changes.
 */
const useIsMobile = () =>
    useSyncExternalStore(
        subscribe,
        () => window.matchMedia(MOBILE_QUERY).matches,
    );

export default useIsMobile;
