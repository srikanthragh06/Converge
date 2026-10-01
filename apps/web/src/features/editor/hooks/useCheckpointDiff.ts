import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import checkpointBlocksQuery from "./checkpointBlocksQuery";
import {
    buildUnifiedDiff,
    type EditorInstance,
    type UnifiedBlockEntry,
} from "@/features/editor/lib/checkpointDiffUtils";

/**
 * Computes the block-level diff shown in the checkpoint history panel.
 * diffType selects which two states to compare: the selected checkpoint
 * against the live editor content ("selectedVsCurrent"), or the selected
 * checkpoint against the one immediately before it ("previousVsSelected").
 * For "selectedVsCurrent" the diff also recomputes on every live editor
 * edit, since editor.document is not itself a stable reference.
 * @param documentId - document the checkpoints belong to
 * @param selectedCheckpointId - checkpoint id currently selected in the list, or null if none is selected yet
 * @param previousCheckpointId - id of the checkpoint immediately before the selected one, or null if there isn't one loaded; only used when diffType is "previousVsSelected"
 * @param diffType - which two states to diff
 * @param editor - the live editor instance, used for "selectedVsCurrent"
 */
const useCheckpointDiff = (
    documentId: number,
    selectedCheckpointId: number | null,
    previousCheckpointId: number | null,
    diffType: "selectedVsCurrent" | "previousVsSelected",
    editor: EditorInstance | null,
) => {
    const [liveDocVersion, setLiveDocVersion] = useState(0); // bumped on every live editor change, so the "selectedVsCurrent" diff recomputes as the user types

    const selected = useQuery({
        ...checkpointBlocksQuery(documentId, selectedCheckpointId ?? 0),
        enabled: selectedCheckpointId !== null,
    });
    const previous = useQuery({
        ...checkpointBlocksQuery(documentId, previousCheckpointId ?? 0),
        enabled:
            diffType === "previousVsSelected" && previousCheckpointId !== null,
    });

    // Tracks live edits for the "selectedVsCurrent" comparison. Runs whenever the
    // editor instance changes (e.g. on document switch); no-ops if there's no editor yet.
    useEffect(() => {
        if (!editor) return;
        return editor.onChange(() => setLiveDocVersion((v) => v + 1));
    }, [editor]);

    // Derives the unified diff from the loaded and live blocks.
    const entries = useMemo((): UnifiedBlockEntry[] => {
        if (!selected.data) return [];
        if (diffType === "selectedVsCurrent") {
            if (!editor) return [];
            return buildUnifiedDiff(selected.data, editor.document);
        }
        if (!previous.data) return [];
        return buildUnifiedDiff(previous.data, selected.data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected.data, previous.data, diffType, editor, liveDocVersion]);

    return {
        entries,
        isLoading:
            selected.isLoading ||
            (diffType === "previousVsSelected" && previous.isLoading), // true while a needed checkpoint's content loads
    };
};

export default useCheckpointDiff;
