import Skeleton from "@/components/ui/Skeleton";
import DelayedRender from "@/components/common/DelayedRender";

/**
 * Placeholder person rows (avatar + line) shown while the Share dialog's
 * data loads.
 * @param count - how many rows to show
 */
const ShareRowsSkeleton = ({ count }: { count: number }) => (
    <DelayedRender>
        <div className="flex flex-col gap-3 py-1.5">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton shape="circle" size="2rem" />
                    <Skeleton height="2rem" />
                </div>
            ))}
        </div>
    </DelayedRender>
);

export default ShareRowsSkeleton;
