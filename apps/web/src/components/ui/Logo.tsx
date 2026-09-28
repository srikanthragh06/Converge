import { cn } from "../../lib/utils";

/**
 * The Converge mark: two chevrons pointing at each other and meeting at the
 * center. Geometry traced from the redesign mockup (PDF p59). Filled with
 * currentColor, so it takes the surrounding text color.
 * @param size - rendered height in px (width follows the 392:344 aspect ratio)
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
        viewBox="0 0 392 344"
        height={size}
        width={(size * 392) / 344}
        fill="currentColor"
        aria-hidden="true"
        className={cn("shrink-0", className)}
    >
        <polygon points="0,0 85,0 196,172 85,344 0,344 85,172" />
        <polygon points="392,0 307,0 196,172 307,344 392,344 307,172" />
    </svg>
);

/**
 * The full logo: the mark followed by the "Converge" wordmark in the serif
 * display face, scaled together from the mark's height.
 * @param size - mark height in px (default 24); the wordmark and gap scale with it
 * @param className - extra classes, e.g. a text color or margin
 */
const Logo = ({ size = 24, className }: { size?: number; className?: string }) => (
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
