import DelayedRender from "../DelayedRender";
import Skeleton from "./Skeleton";

/**
 * Placeholder rows shown in a Table while its data loads, after a short
 * delay so a fast response never flashes them.
 * @param rows - how many placeholder rows to show
 */
const TableSkeleton = ({ rows }: { rows: number }) => (
    <DelayedRender>
        <div className="flex flex-col gap-2 px-3 py-2">
            {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} height="2.25rem" />
            ))}
        </div>
    </DelayedRender>
);

export default TableSkeleton;
