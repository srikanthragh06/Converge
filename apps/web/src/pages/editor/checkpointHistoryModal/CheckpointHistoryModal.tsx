import { Skeleton } from "primereact/skeleton";
import useCheckpointHistory from "../../../hooks/useCheckpointHistory";
import CheckpointListItem from "./CheckpointListItem";
import DelayedRender from "../../../components/DelayedRender";

/**
 * Modal for browsing a document's version-history checkpoints. Renders as a
 * centred dialog on all screen sizes. Closes on backdrop click. Left side
 * lists checkpoints with infinite-scroll pagination; right side is reserved
 * for the diff view, not yet built.
 */
const CheckpointHistoryModal = ({
    documentId,
    onClose,
}: {
    /** ID of the document whose checkpoints to list. */
    documentId: string | undefined;
    /** Called when the user dismisses the modal. */
    onClose: () => void;
}) => {
    const { checkpoints, isLoading, isFetchingMore, sentinelRef } =
        useCheckpointHistory(documentId);

    return (
        <>
            {/* Backdrop — click outside the panel to close */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={onClose}
            >
                {/* Panel — stop backdrop-click from propagating */}
                <div
                    className="bg-background-base w-full sm:max-w-4xl sm:mx-4
                    rounded-xl
                    h-[80dvh] sm:h-[70vh]
                    flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-row h-full">
                        {/* Left: checkpoint list */}
                        <div className="w-[260px] shrink-0 border-r border-background-elevated flex flex-col min-h-0">
                            <p className="text-sm font-medium text-text-primary px-3 py-2.5 shrink-0 border-b border-background-elevated">
                                Checkpoints
                            </p>
                            {isLoading ? (
                                <DelayedRender>
                                    <div className="flex flex-col gap-2 p-3">
                                        <Skeleton height="2.5rem" width="100%" />
                                        <Skeleton height="2.5rem" width="100%" />
                                        <Skeleton height="2.5rem" width="100%" />
                                    </div>
                                </DelayedRender>
                            ) : checkpoints.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-text-disabled text-sm">
                                    No checkpoints
                                </div>
                            ) : (
                                <div
                                    className="flex-1 min-h-0 overflow-y-auto"
                                    style={{ scrollbarWidth: "thin" }}
                                >
                                    {checkpoints.map((checkpoint) => (
                                        <CheckpointListItem
                                            key={checkpoint.id}
                                            checkpoint={checkpoint}
                                        />
                                    ))}
                                    {/* Sentinel observed by IntersectionObserver to trigger the next page load */}
                                    <div
                                        ref={sentinelRef}
                                        className="border-2 border-solid border-transparent"
                                    />
                                    {isFetchingMore && (
                                        <DelayedRender>
                                            <div className="flex flex-col gap-2 p-3">
                                                <Skeleton
                                                    height="2.5rem"
                                                    width="100%"
                                                />
                                                <Skeleton
                                                    height="2.5rem"
                                                    width="100%"
                                                />
                                            </div>
                                        </DelayedRender>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Right: diff view — placeholder until built */}
                        <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                            Select a checkpoint to view its diff.
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CheckpointHistoryModal;
