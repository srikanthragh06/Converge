import { useState } from "react";
import { Skeleton } from "primereact/skeleton";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";
import { IoIosMenu } from "react-icons/io";
import useCheckpointHistory from "../../../hooks/useCheckpointHistory";
import CheckpointListItem from "./CheckpointListItem";
import DelayedRender from "../../../components/DelayedRender";

/**
 * Modal for browsing a document's version-history checkpoints. Renders as a
 * centred dialog on all screen sizes. Closes on backdrop click. Left side
 * lists checkpoints with infinite-scroll pagination; right side is reserved
 * for the diff view, not yet built. On mobile the list acts like Sidebar's
 * own collapsible pattern — full width by default, minimizable via the
 * arrow button down to a slim strip with a menu button that reopens it,
 * revealing the right side while collapsed. On sm+ screens both sides are
 * always shown side by side at a fixed list width, so isListCollapsed has no
 * visual effect there.
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
    const [isListCollapsed, setIsListCollapsed] = useState(false); // mobile-only: true hides the checkpoint list and reveals the right side

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
                        {/* Collapsed slim strip — mobile only, shown only while the list is
                            minimized. Reopens the list, same pattern as Sidebar's own
                            collapsed state (a slim column with just a menu button). */}
                        {isListCollapsed && (
                            <div className="sm:hidden w-10 shrink-0 border-r border-background-elevated p-2">
                                <button
                                    onClick={() => setIsListCollapsed(false)}
                                    aria-label="Open checkpoint list"
                                    className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer border-none bg-transparent text-text-primary"
                                >
                                    <IoIosMenu className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        {/* Left: checkpoint list — full width and collapsible on mobile, fixed-width and always visible on sm+ */}
                        <div
                            className={`${isListCollapsed ? "hidden" : "flex w-full"} sm:flex sm:w-[260px] shrink-0 border-r border-background-elevated flex-col min-h-0`}
                        >
                            <div className="flex items-center justify-between px-3 py-2.5 shrink-0 border-b border-background-elevated">
                                <p className="text-sm font-medium text-text-primary">
                                    Checkpoints
                                </p>
                                {/* Minimize button — mobile only, collapses the list to reveal the right side */}
                                <button
                                    onClick={() => setIsListCollapsed(true)}
                                    aria-label="Minimize checkpoint list"
                                    className="sm:hidden p-1 rounded-md hover:bg-background-hover transition cursor-pointer border-none bg-transparent text-text-primary"
                                >
                                    <MdKeyboardDoubleArrowLeft className="w-5 h-5" />
                                </button>
                            </div>
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
                        {/* Right: diff view — placeholder until built. Hidden on mobile
                            unless the list is minimized, since the two sides share the
                            full-width mobile layout instead of sitting side by side. */}
                        <div
                            className={`${isListCollapsed ? "flex" : "hidden"} sm:flex flex-1 items-center justify-center text-text-secondary text-sm`}
                        >
                            Select a checkpoint to view its diff.
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CheckpointHistoryModal;
