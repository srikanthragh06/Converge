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
import Button from "../../../components/ui/Button";
import DiffBlockNoteView from "./DiffBlockNoteView";

/** Which two document states to diff against each other. */
type DiffType = "selectedVsCurrent" | "previousVsSelected";

/** How long the success status is shown before the modal auto-closes. */
const RESTORE_SUCCESS_CLOSE_DELAY_MS = 800;

/** The two comparison tabs, in display order, with the mockup's labels. */
const DIFF_TABS: { type: DiffType; label: string }[] = [
    { type: "previousVsSelected", label: "What changed in this checkpoint" },
    {
        type: "selectedVsCurrent",
        label: "This checkpoint vs. current document",
    },
];

/**
 * Right-side panel of CheckpointHistoryModal (pp 50 / 56). Diffs the
 * selected checkpoint either against the checkpoint immediately before it
 * ("What changed in this checkpoint") or against the live editor content
 * ("This checkpoint vs. current document"), picked with a segmented control,
 * with the +added −removed block counts beside it. The footer holds the
 * Added / Removed legend and, for editor+ users, Cancel and "Restore this
 * checkpoint"; restoring overwrites the live document, so it asks for
 * confirmation in the footer first.
 */
const CheckpointDiffView = ({
    documentId,
    selectedCheckpoint,
    previousCheckpoint,
    editor,
    isEditable,
    onClose,
}: {
    /** ID of the document the checkpoints belong to. */
    documentId: string | undefined;
    /** Checkpoint currently selected in the list. */
    selectedCheckpoint: DocumentCheckpointDto;
    /** Checkpoint immediately before the selected one, or null if none is loaded. */
    previousCheckpoint: DocumentCheckpointDto | null;
    /** Live editor instance, used for the "This checkpoint vs. current document" comparison and as the restore target. */
    editor: EditorInstance | null;
    /** Whether the requesting user has editor+ resolved access. Restore access is only
     * enforced server-side at the Yjs sync layer, which drops an unauthorized write
     * silently rather than returning an error — so the restore buttons are hidden
     * entirely for a viewer instead of letting them hit that dead end. */
    isEditable: boolean;
    /** Closes CheckpointHistoryModal: the footer's Cancel, and after a successful restore. */
    onClose: () => void;
}) => {
    const [diffType, setDiffType] = useState<DiffType>(
        previousCheckpoint ? "previousVsSelected" : "selectedVsCurrent",
    ); // which two states to diff — defaults to what changed in this checkpoint when the previous one is loaded, else falls back to this checkpoint vs. the current document
    const [isConfirmingRestore, setIsConfirmingRestore] = useState(false); // true while the footer asks "are you sure" instead of showing the legend

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

    const addedCount = entries.filter((e) => e.status === "added").length; // number of added blocks, shown in green beside the tabs
    const removedCount = entries.filter((e) => e.status === "removed").length; // number of removed blocks, shown in red beside the tabs
    const isRestoreBusy =
        restoreStatus === "loading" || restoreStatus === "success"; // locks the footer while a restore is in flight or about to close the modal

    // Closes the modal shortly after a successful restore, so the user briefly
    // sees the success indicator before landing back in the editor.
    useEffect(() => {
        if (restoreStatus !== "success") return;
        const timeoutId = setTimeout(onClose, RESTORE_SUCCESS_CLOSE_DELAY_MS);
        return () => clearTimeout(timeoutId);
    }, [restoreStatus, onClose]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Comparison tabs and the current change count */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-line bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div
                    role="tablist"
                    className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-track p-1 sm:flex-row"
                >
                    {DIFF_TABS.map(({ type, label }) => (
                        <button
                            key={type}
                            type="button"
                            role="tab"
                            aria-selected={diffType === type}
                            onClick={() => setDiffType(type)}
                            disabled={
                                type === "previousVsSelected" &&
                                !previousCheckpoint
                            }
                            className={`cursor-pointer truncate rounded-md px-3 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-default disabled:opacity-40 ${
                                diffType === type
                                    ? "bg-surface-elevated font-semibold text-fg shadow-sm shadow-shadow"
                                    : "text-fg-muted hover:text-fg"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {!isLoading && (
                    <span className="shrink-0 font-mono text-[13px] sm:ml-auto">
                        <span className="text-diff-added-fg">
                            +{addedCount}
                        </span>{" "}
                        <span className="text-diff-removed-fg">
                            −{removedCount}
                        </span>
                    </span>
                )}
            </div>
            {/* Diff content — loading state, empty state, or the rendered diff blocks */}
            <div className="flex min-h-0 flex-1 flex-col bg-surface-inset">
                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-fg-muted">
                        Loading…
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-fg-muted">
                        No changes.
                    </div>
                ) : (
                    <DiffBlockNoteView entries={entries} />
                )}
            </div>
            {/* Footer — the legend (or the restore question while confirming)
                on the left; Cancel and Restore on the right, editor+ only. */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-line bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:px-5 sm:py-4">
                {isConfirmingRestore ? (
                    <p className="min-w-0 flex-1 text-[13px] text-fg-secondary">
                        Restore the document to this checkpoint? This will
                        overwrite the current content.
                    </p>
                ) : (
                    <div className="flex flex-1 items-center gap-5 text-[13px] text-fg-muted">
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-[3px] border border-diff-added-fg bg-diff-added" />
                            Added
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-[3px] border border-diff-removed-fg bg-diff-removed" />
                            <span className="line-through">Removed</span>
                        </span>
                    </div>
                )}
                {isEditable && (
                    <div className="flex shrink-0 gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                        <Button
                            onClick={
                                isConfirmingRestore
                                    ? () => setIsConfirmingRestore(false)
                                    : onClose
                            }
                            disabled={isRestoreBusy}
                        >
                            Cancel
                        </Button>
                        {isConfirmingRestore ? (
                            <Button
                                variant="primary"
                                onClick={() =>
                                    restoreCheckpoint(selectedCheckpoint.id)
                                }
                                disabled={restoreStatus === "loading"}
                                className="font-semibold"
                            >
                                {restoreStatus === "loading" ? (
                                    <AiOutlineLoading3Quarters className="animate-spin" />
                                ) : restoreStatus === "success" ? (
                                    <MdOutlineCheckCircle />
                                ) : restoreStatus === "error" ? (
                                    <MdOutlineError />
                                ) : (
                                    <MdOutlineRestore />
                                )}
                                {restoreStatus === "success"
                                    ? "Restored"
                                    : "Restore"}
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={() => setIsConfirmingRestore(true)}
                                className="font-semibold"
                            >
                                <MdOutlineRestore />
                                Restore this checkpoint
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckpointDiffView;
