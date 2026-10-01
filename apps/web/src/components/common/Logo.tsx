import { cn } from "@/lib/utils";

/**
 * The Converge mark: two chevrons pointing at each other, their tips almost
 * meeting at the center. Filled with currentColor, so it takes the
 * surrounding text color.
 * @param size - rendered height in px (width follows the 56:52 aspect ratio)
 * @param className - extra classes, e.g. a text color
 */
export const LogoMark = ({
    size = 24,
    className,
}: {
    size?: number;
    className?: string;
}) => (
    <svg
        viewBox="4 6 56 52"
        height={size}
        width={(size * 56) / 52}
        fill="currentColor"
        aria-hidden="true"
        className={cn("shrink-0", className)}
    >
        <path d="M4 6h12l14 26-14 26H4l14-26z" />
        <path d="M60 6H48L34 32l14 26h12L46 32z" />
    </svg>
);

/**
 * The full logo: the mark followed by the "Converge" wordmark in the serif
 * display face, scaled together from the mark's height.
 * @param size - mark height in px (default 24); the wordmark and gap scale with it
 * @param className - extra classes, e.g. a text color or margin
 */
const Logo = ({
    size = 24,
    className,
}: {
    size?: number;
    className?: string;
}) => (
    <span
        role="img"
        aria-label="Converge"
        className={cn("inline-flex items-baseline text-fg", className)}
        style={{ gap: size * 0.45 }}
    >
        <LogoMark size={size} />
        <span
            aria-hidden="true"
            className="font-serif font-medium leading-none"
            style={{ fontSize: size * 1.55 }}
        >
            Converge
        </span>
    </span>
);

export default Logo;
