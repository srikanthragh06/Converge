import type { ReactNode } from "react";
import Button, { type ButtonVariant } from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";

/**
 * One icon button in the collapsed sidebar rail, labelled by a tooltip on its right.
 * @param label - tooltip text and accessible name
 * @param icon - the icon shown
 * @param onClick - the action
 * @param shortcut - keyboard hint shown in the tooltip
 * @param active - shows the selected fill, for the page currently open
 * @param variant - button style (default "ghost"); "primary" for New document
 */
const RailButton = ({
    label,
    icon,
    onClick,
    shortcut,
    active,
    variant = "ghost",
}: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    shortcut?: string;
    active?: boolean;
    variant?: ButtonVariant;
}) => (
    <Tooltip content={label} shortcut={shortcut} side="right">
        <Button
            variant={variant}
            size="icon"
            pressed={active}
            aria-label={label}
            onClick={onClick}
        >
            {icon}
        </Button>
    </Tooltip>
);

export default RailButton;
