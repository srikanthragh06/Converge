import { useEffect, useState } from "react";
import type { DocumentCheckpointDto } from "@converge/shared";
import {
    MdOutlineRestore,
    MdOutlineCheckCircle,
    MdOutlineError,
} from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import useCheckpointDiff from "../../../hooks/useCheckpointDiff";
import useRestoreCheckpoint from "../../../hooks/useRestoreCheckpoint";
import type { EditorInstance } from "../../../utils/checkpointDiffUtils";
import DiffBlockNoteView from "./DiffBlockNoteView";
import { colors } from "../../../theme/colors";

/** Which two document states to diff against each other. */
type DiffType = "selectedVsCurrent" | "previousVsSelected";

/** How long the success status is shown before the modal auto-closes. */
const RESTORE_SUCCESS_CLOSE_DELAY_MS = 800;

/**
 * Right-side panel of CheckpointHistoryModal. Diffs the selected checkpoint
 * either against the checkpoint immediately before it or against the live
 * editor content, toggled via the comparison-mode buttons. A sticky footer
 * lets the user restore the selected checkpoint's content into the live
 * document, behind an inline confirmation step.
 */
const CheckpointDiffView = ({
    documentId,
    selectedCheckpoint,
    previousCheckpoint,
    editor,
    onClose,
}: {
    /** ID of the document the checkpoints belong to. */
    documentId: string | undefined;
    /** Checkpoint currently selected in the list. */
    selectedCheckpoint: DocumentCheckpointDto;
    /** Checkpoint immediately before the selected one, or null if none is loaded. */
    previousCheckpoint: DocumentCheckpointDto | null;
    /** Live editor instance, used for the "Curr. Checkpoint vs Curr. Document" comparison and as the restore target. */
    editor: EditorInstance | null;
    /** Called after a successful restore, to dismiss CheckpointHistoryModal and return to the editor. */
    onClose: () => void;
}) => {
    const [diffType, setDiffType] = useState<DiffType>(
        previousCheckpoint ? "previousVsSelected" : "selectedVsCurrent",
    ); // which two states to diff — defaults to Prev. Checkpoint vs Curr. Checkpoint when one is loaded, else falls back to Curr. Checkpoint vs Curr. Document
    const [isConfirmingRestore, setIsConfirmingRestore] = useState(false); // true while the footer shows the "are you sure" step instead of the Restore button

    const { entries, isLoading } = useCheckpointDiff(
        documentId,
        selectedCheckpoint.id,
        previousCheckpoint?.id ?? null,
        diffType,
        editor,
    );
    const { restoreCheckpoint, status: restoreStatus } = useRestoreCheckpoint(
        documentId,
        editor,
    );

    const addedCount = entries.filter((e) => e.status === "added").length; // number of added blocks, shown in green in the change-count line
    const removedCount = entries.filter((e) => e.status === "removed").length; // number of removed blocks, shown in red in the change-count line

    // Closes the modal shortly after a successful restore, so the user briefly
    // sees the success indicator before landing back in the editor.
    useEffect(() => {
        if (restoreStatus !== "success") return;
        const timeoutId = setTimeout(onClose, RESTORE_SUCCESS_CLOSE_DELAY_MS);
        return () => clearTimeout(timeoutId);
    }, [restoreStatus, onClose]);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Comparison-mode toggle and the current change count */}
            <div className="flex flex-col gap-1.5 px-3 py-2.5 shrink-0 border-b border-background-elevated">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1">
                    <button
                        onClick={() => setDiffType("previousVsSelected")}
                        disabled={!previousCheckpoint}
                        className={`w-full sm:w-auto px-2 py-1.5 sm:py-1 text-xs rounded-md border-none cursor-pointer transition disabled:cursor-default disabled:opacity-40
                            ${
                                diffType === "previousVsSelected"
                                    ? "bg-background-elevated text-text-primary"
                                    : "bg-transparent text-text-secondary hover:opacity-80"
                            }`}
                    >
                        Prev. Checkpoint vs Curr. Checkpoint
                    </button>
                    <button
                        onClick={() => setDiffType("selectedVsCurrent")}
                        className={`w-full sm:w-auto px-2 py-1.5 sm:py-1 text-xs rounded-md border-none cursor-pointer transition
                            ${
                                diffType === "selectedVsCurrent"
                                    ? "bg-background-elevated text-text-primary"
                                    : "bg-transparent text-text-secondary hover:opacity-80"
                            }`}
                    >
                        Curr. Checkpoint vs Curr. Document
                    </button>
                </div>
                {!isLoading && (
                    <span className="text-xs self-start sm:self-end shrink-0 whitespace-nowrap">
                        <span style={{ color: colors.highlights.green.text }}>
                            +{addedCount}
                        </span>{" "}
                        <span style={{ color: colors.highlights.red.text }}>
                            -{removedCount}
                        </span>
                    </span>
                )}
            </div>
            {/* Diff content — loading state, empty state, or the rendered diff blocks */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                    Loading…
                </div>
            ) : entries.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                    No changes.
                </div>
            ) : (
                <DiffBlockNoteView entries={entries} />
            )}
            {/* Restore footer — sticky at the bottom of the panel. Swaps between a
                single "Restore this checkpoint" button and an inline confirm step,
                so restoring (which overwrites the live document) always requires
                a deliberate second click. */}
            <div className="shrink-0 border-t border-background-elevated px-3 py-2.5">
                {isConfirmingRestore ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-text-secondary">
                            Restore the document to this checkpoint? This
                            will overwrite the current content.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsConfirmingRestore(false)}
                                disabled={
                                    restoreStatus === "loading" ||
                                    restoreStatus === "success"
                                }
                                className="flex-1 px-2 py-1.5 text-xs rounded-md border-none cursor-pointer transition bg-transparent text-text-secondary hover:opacity-80 disabled:cursor-default disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() =>
                                    restoreCheckpoint(selectedCheckpoint.id)
                                }
                                disabled={restoreStatus === "loading"}
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border-none cursor-pointer transition bg-white text-black hover:opacity-90 active:opacity-80 disabled:cursor-default disabled:opacity-60"
                            >
                                {restoreStatus === "loading" ? (
                                    <AiOutlineLoading3Quarters className="w-3.5 h-3.5 animate-spin" />
                                ) : restoreStatus === "success" ? (
                                    <MdOutlineCheckCircle className="w-3.5 h-3.5" />
                                ) : restoreStatus === "error" ? (
                                    <MdOutlineError className="w-3.5 h-3.5" />
                                ) : (
                                    <MdOutlineRestore className="w-3.5 h-3.5" />
                                )}
                                {restoreStatus === "success"
                                    ? "Restored"
                                    : "Restore"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsConfirmingRestore(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border-none cursor-pointer transition bg-white text-black hover:opacity-90 active:opacity-80"
                    >
                        <MdOutlineRestore className="w-3.5 h-3.5" />
                        Restore this checkpoint
                    </button>
                )}
            </div>
        </div>
    );
};

export default CheckpointDiffView;
