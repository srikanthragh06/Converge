import { useState } from "react";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";
import { IoIosMenu } from "react-icons/io";
import { FaRegSave } from "react-icons/fa";
import { LuCheck, LuCircleAlert, LuLoaderCircle } from "react-icons/lu";
import Skeleton from "../../../components/ui/Skeleton";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import useCheckpointHistory from "../../../hooks/useCheckpointHistory";
import useCreateCheckpoint from "../../../hooks/useCreateCheckpoint";
import useToast from "../../../hooks/useToast";
import CheckpointListItem from "./CheckpointListItem";
import DelayedRender from "../../../components/DelayedRender";
import CheckpointDiffView from "./CheckpointDiffView";
import type { EditorInstance } from "../../../utils/checkpointDiffUtils";

/**
 * Version history (pp 50 / 56): a wide Modal titled with the document's
 * name, with "Save checkpoint now" (editor+ only) in its header. Left side
 * lists checkpoints newest first with infinite-scroll pagination and a
 * single-select highlight, defaulting to the newest checkpoint; right side
 * renders CheckpointDiffView, diffing whichever checkpoint is selected
 * against either the one before it or the live editor content, and, for
 * editor+ users, offering a restore action that overwrites the live document
 * and closes this modal on success. Saving a checkpoint reloads the list so
 * the new one appears selected at the top. On phones the list is full width
 * and minimizable via the arrow button down to a slim strip with a menu
 * button that reopens it, revealing the diff while collapsed; on sm+ screens
 * both sides sit side by side, so isListCollapsed has no visual effect there.
 */
const CheckpointHistoryModal = ({
    documentId,
    documentTitle,
    editor,
    isEditable,
    onClose,
}: {
    /** ID of the document whose checkpoints to list. */
    documentId: string | undefined;
    /** Title of the document, shown beside the modal title. */
    documentTitle: string;
    /** Live editor instance, forwarded to CheckpointDiffView for its live-document comparison. */
    editor: EditorInstance | null;
    /** Whether the requesting user has editor+ resolved access, gating Save checkpoint now and (via CheckpointDiffView) the restore action — restore access is only enforced server-side at the Yjs sync layer, which drops unauthorized writes silently rather than returning an error, so the UI hides the action entirely instead of letting a viewer hit that dead end. */
    isEditable: boolean;
    /** Called when the user dismisses the modal. */
    onClose: () => void;
}) => {
    const {
        checkpoints,
        isLoading,
        isFetchingMore,
        sentinelRef,
        selectedCheckpoint,
        setSelectedCheckpoint,
        refresh,
    } = useCheckpointHistory(documentId);
    const { createCheckpoint, status: createCheckpointStatus } =
        useCreateCheckpoint(documentId); // "Save checkpoint now" request + its idle/loading/success/error status
    const { showToast } = useToast(); // reports when there was nothing new to checkpoint
    const [isListCollapsed, setIsListCollapsed] = useState(false); // mobile-only: true hides the checkpoint list and reveals the right side

    // The list is newest-first, so the checkpoint immediately before the selected one —
    // needed for the "What changed in this checkpoint" comparison — sits right after it in the array.
    const selectedIndex = checkpoints.findIndex(
        (c) => c.id === selectedCheckpoint?.id,
    );
    const previousCheckpoint =
        selectedIndex === -1 ? null : (checkpoints[selectedIndex + 1] ?? null);

    /**
     * Takes a manual checkpoint, then reloads the list so it shows up
     * selected at the top, or says so when nothing changed since the last one.
     */
    const saveCheckpoint = async () => {
        const result = await createCheckpoint();
        if (!result) return; // the button's alert icon reports the failure
        if (result.created) refresh();
        else showToast("No changes since the last checkpoint");
    };

    return (
        <Modal
            onClose={onClose}
            title="Version history"
            titleAside={
                // Phones have no room beside the title for the document name.
                <span className="hidden sm:inline">
                    {documentTitle || "Untitled"}
                </span>
            }
            headerActions={
                isEditable && (
                    <Button
                        onClick={saveCheckpoint}
                        disabled={createCheckpointStatus !== "idle"}
                        aria-label="Save checkpoint now"
                        className="disabled:opacity-100"
                    >
                        {createCheckpointStatus === "loading" ? (
                            <LuLoaderCircle className="animate-spin" />
                        ) : createCheckpointStatus === "success" ? (
                            <LuCheck className="text-success" />
                        ) : createCheckpointStatus === "error" ? (
                            <LuCircleAlert className="text-danger" />
                        ) : (
                            <FaRegSave />
                        )}
                        <span className="hidden sm:inline">
                            Save checkpoint now
                        </span>
                    </Button>
                )
            }
            size="xl"
            className="h-[min(790px,100%)] max-w-[1060px]"
            bodyClassName="flex-row overflow-hidden border-t border-line p-0 sm:p-0"
        >
            {/* Collapsed slim strip — mobile only, shown only while the list is
                minimized. Reopens the list, same pattern as Sidebar's own
                collapsed state (a slim column with just a menu button). */}
            {isListCollapsed && (
                <div className="w-11 shrink-0 border-r border-line p-1.5 sm:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsListCollapsed(false)}
                        aria-label="Open checkpoint list"
                    >
                        <IoIosMenu />
                    </Button>
                </div>
            )}
            {/* Left: checkpoint list — full width and collapsible on mobile, fixed-width and always visible on sm+ */}
            <div
                className={`${isListCollapsed ? "hidden" : "flex w-full"} min-h-0 shrink-0 flex-col border-r border-line sm:flex sm:w-[300px]`}
            >
                <div className="flex shrink-0 items-center justify-between px-4 py-3 text-[13px] text-fg-muted">
                    <span>Checkpoints</span>
                    <span className="hidden sm:inline">Newest first</span>
                    {/* Minimize button — mobile only, collapses the list to reveal the right side */}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsListCollapsed(true)}
                        aria-label="Minimize checkpoint list"
                        className="sm:hidden"
                    >
                        <MdKeyboardDoubleArrowLeft />
                    </Button>
                </div>
                {isLoading ? (
                    <DelayedRender>
                        <div className="flex flex-col gap-2 px-4">
                            <Skeleton height="3.5rem" width="100%" />
                            <Skeleton height="3.5rem" width="100%" />
                            <Skeleton height="3.5rem" width="100%" />
                        </div>
                    </DelayedRender>
                ) : checkpoints.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-fg-muted">
                        No checkpoints yet
                    </div>
                ) : (
                    <div
                        className="min-h-0 flex-1 overflow-y-auto"
                        style={{ scrollbarWidth: "thin" }}
                    >
                        {checkpoints.map((checkpoint) => (
                            <CheckpointListItem
                                key={checkpoint.id}
                                checkpoint={checkpoint}
                                isSelected={
                                    checkpoint.id === selectedCheckpoint?.id
                                }
                                onSelect={() =>
                                    setSelectedCheckpoint(checkpoint)
                                }
                            />
                        ))}
                        {/* Sentinel observed by IntersectionObserver to trigger the next page load */}
                        <div
                            ref={sentinelRef}
                            className="border-2 border-solid border-transparent"
                        />
                        {isFetchingMore && (
                            <DelayedRender>
                                <div className="flex flex-col gap-2 px-4 pb-3">
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                </div>
                            </DelayedRender>
                        )}
                    </div>
                )}
            </div>
            {/* Right: diff view for the selected checkpoint, or a prompt when
                none is picked yet. Hidden on mobile unless the list is
                minimized, since the two sides share the full-width mobile
                layout instead of sitting side by side. */}
            <div
                className={`${isListCollapsed ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col sm:flex`}
            >
                {selectedCheckpoint === null ? (
                    <div className="flex flex-1 items-center justify-center bg-surface-inset text-sm text-fg-muted">
                        Select a checkpoint to view its diff.
                    </div>
                ) : (
                    <CheckpointDiffView
                        key={selectedCheckpoint.id}
                        documentId={documentId}
                        selectedCheckpoint={selectedCheckpoint}
                        previousCheckpoint={previousCheckpoint}
                        editor={editor}
                        isEditable={isEditable}
                        onClose={onClose}
                    />
                )}
            </div>
        </Modal>
    );
};

export default CheckpointHistoryModal;
