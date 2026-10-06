import { formatDate, timeAgo } from "@/lib/utils";
import Tooltip from "@/components/ui/Tooltip";

/**
 * Relative time ("3h ago") that shows the exact date and time on hover.
 * @param date - the time to describe
 * @param capitalize - start with a capital ("Just now"), e.g. for a table cell
 */
const RelativeTime = ({
    date,
    capitalize = false,
}: {
    date: Date | string;
    capitalize?: boolean;
}) => {
    const text = timeAgo(date);

    return (
        <Tooltip content={formatDate(date, { seconds: false })}>
            <span>
                {capitalize
                    ? text.charAt(0).toUpperCase() + text.slice(1)
                    : text}
            </span>
        </Tooltip>
    );
};

export default RelativeTime;
