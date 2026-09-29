import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Right-aligned button row at the bottom of a Modal body.
 * @param className - extra classes, e.g. `justify-between` to push a button to the left
 */
const ModalFooter = ({ className, ...rest }: ComponentProps<"div">) => (
    <div
        className={cn("mt-5 flex items-center justify-end gap-2", className)}
        {...rest}
    />
);

export default ModalFooter;
