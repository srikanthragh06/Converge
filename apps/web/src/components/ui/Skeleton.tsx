import { cn } from "../../lib/utils";

/**
 * Pulsing placeholder block shown while content loads.
 * @param width - CSS width of a rectangle skeleton (default "100%")
 * @param height - CSS height of a rectangle skeleton (default "1rem")
 * @param shape - "rectangle" (rounded corners) or "circle"
 * @param size - CSS width and height of a circle skeleton; overrides width/height
 * @param className - extra classes, e.g. margins
 */
const Skeleton = ({
    width = "100%",
    height = "1rem",
    shape = "rectangle",
    size,
    className,
}: {
    width?: string;
    height?: string;
    shape?: "rectangle" | "circle";
    size?: string;
    className?: string;
}) => (
    <div
        className={cn(
            "animate-pulse bg-surface-selected",
            shape === "circle" ? "shrink-0 rounded-full" : "rounded-md",
            className,
        )}
        style={{ width: size ?? width, height: size ?? height }}
    />
);

export default Skeleton;
