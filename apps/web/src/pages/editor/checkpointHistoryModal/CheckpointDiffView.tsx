import { useState } from "react";
import type { DocumentCheckpointDto } from "@converge/shared";
import useCheckpointDiff from "../../../hooks/useCheckpointDiff";
import type { EditorInstance } from "../../../utils/checkpointDiffUtils";
import DiffBlockNoteView from "./DiffBlockNoteView";
import { colors } from "../../../theme/colors";

/** Which two document states to diff against each other. */
type DiffType = "selectedVsCurrent" | "previousVsSelected";

/**
 * Right-side panel of CheckpointHistoryModal. Diffs the selected checkpoint
 * either against the checkpoint immediately before it or against the live
 * editor content, toggled via the comparison-mode buttons.
 */
const CheckpointDiffView = ({
    documentId,
    selectedCheckpoint,
    previousCheckpoint,
    editor,
}: {
    /** ID of the document the checkpoints belong to. */
    documentId: string | undefined;
    /** Checkpoint currently selected in the list. */
    selectedCheckpoint: DocumentCheckpointDto;
    /** Checkpoint immediately before the selected one, or null if none is loaded. */
    previousCheckpoint: DocumentCheckpointDto | null;
    /** Live editor instance, used for the "Curr. Checkpoint vs Curr. Document" comparison. */
    editor: EditorInstance | null;
}) => {
    const [diffType, setDiffType] = useState<DiffType>(
        previousCheckpoint ? "previousVsSelected" : "selectedVsCurrent",
    ); // which two states to diff — defaults to Prev. Checkpoint vs Curr. Checkpoint when one is loaded, else falls back to Curr. Checkpoint vs Curr. Document

    const { entries, isLoading } = useCheckpointDiff(
        documentId,
        selectedCheckpoint.id,
        previousCheckpoint?.id ?? null,
        diffType,
        editor,
    );

    const addedCount = entries.filter((e) => e.status === "added").length; // number of added blocks, shown in green in the change-count line
    const removedCount = entries.filter((e) => e.status === "removed").length; // number of removed blocks, shown in red in the change-count line

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
        </div>
    );
};

export default CheckpointDiffView;
