import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { BlockNoteEditor } from "@blocknote/core";
import apiClient from "../lib/http";
import editorSchema from "../lib/editorSchema";
import type { GetDocumentCheckpointContentResponseDto } from "@converge/shared";
import {
    base64ToUint8Array,
    buildUnifiedDiff,
    type DocBlock,
    type EditorInstance,
    type UnifiedBlockEntry,
} from "../utils/checkpointDiffUtils";

/**
 * Fetches a checkpoint's reconstructed content and decodes it into BlockNote
 * blocks. Applies the checkpoint's Yjs update to a scratch Y.Doc, then mounts
 * a throwaway BlockNoteEditor to a detached (never-appended) div purely to
 * trigger the collaboration binding's initial sync into .document.
 * @param documentId - document the checkpoint belongs to
 * @param checkpointId - checkpoint to fetch and decode
 * @returns the checkpoint's blocks at the time it was taken
 */
const fetchCheckpointBlocks = async (
    documentId: string,
    checkpointId: number,
): Promise<DocBlock[]> => {
    const { data } =
        await apiClient.get<GetDocumentCheckpointContentResponseDto>(
            `/document/${documentId}/checkpoints/${checkpointId}`,
        );

    const scratchDoc = new Y.Doc();
    Y.applyUpdate(scratchDoc, base64ToUint8Array(data.updateBase64));

    const scratchEditor = BlockNoteEditor.create({
        schema: editorSchema,
        collaboration: {
            fragment: scratchDoc.getXmlFragment("blocknote"),
            provider: {},
            user: { name: "", color: "" },
        },
    });
    scratchEditor.mount(document.createElement("div"));
    const blocks = scratchEditor.document;
    scratchEditor.unmount();

    return blocks;
};

/**
 * Computes the block-level diff shown in the checkpoint history panel.
 * diffType selects which two states to compare: the selected checkpoint
 * against the live editor content ("selectedVsCurrent"), or the selected
 * checkpoint against the one immediately before it ("previousVsSelected").
 * Refetches whenever documentId, the relevant checkpoint id(s), or diffType
 * change; for "selectedVsCurrent" the diff also recomputes on every live
 * editor edit, since editor.document is not itself a stable reference.
 * @param documentId - document the checkpoints belong to
 * @param selectedCheckpointId - checkpoint id currently selected in the list, or null if none is selected yet
 * @param previousCheckpointId - id of the checkpoint immediately before the selected one, or null if there isn't one loaded; only used when diffType is "previousVsSelected"
 * @param diffType - which two states to diff
 * @param editor - the live editor instance, used for "selectedVsCurrent"
 */
const useCheckpointDiff = (
    documentId: string | undefined,
    selectedCheckpointId: number | null,
    previousCheckpointId: number | null,
    diffType: "selectedVsCurrent" | "previousVsSelected",
    editor: EditorInstance | null,
) => {
    const [oldBlocks, setOldBlocks] = useState<DocBlock[] | null>(null); // "old" side of the comparison — the previous checkpoint, or the selected checkpoint, depending on diffType
    const [newBlocks, setNewBlocks] = useState<DocBlock[] | null>(null); // "new" side of the comparison — the selected checkpoint; unused for "selectedVsCurrent", which reads live blocks straight from editor.document instead
    const [isLoading, setIsLoading] = useState(false); // true while the checkpoint-content fetch(es) for this diffType are in flight
    const [liveDocVersion, setLiveDocVersion] = useState(0); // bumped on every live editor change, so the "selectedVsCurrent" diff recomputes as the user types

    // Tracks live edits for the "selectedVsCurrent" comparison. Runs whenever the
    // editor instance changes (e.g. on document switch); no-ops if there's no editor yet.
    useEffect(() => {
        if (!editor) return;
        return editor.onChange(() => setLiveDocVersion((v) => v + 1));
    }, [editor]);

    // Fetches and decodes whichever checkpoint(s) diffType requires. Skips fetching
    // the live side entirely — that comes straight from editor.document in the memo
    // below. Guards against a stale response overwriting state after the inputs have
    // already changed again (e.g. the user picks a different checkpoint mid-fetch).
    useEffect(() => {
        if (!documentId || selectedCheckpointId === null) {
            setOldBlocks(null);
            setNewBlocks(null);
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                setIsLoading(true);
                if (diffType === "selectedVsCurrent") {
                    const blocks = await fetchCheckpointBlocks(
                        documentId,
                        selectedCheckpointId,
                    );
                    if (cancelled) return;
                    setOldBlocks(blocks);
                    setNewBlocks(null);
                } else if (diffType === "previousVsSelected") {
                    if (previousCheckpointId === null) {
                        if (!cancelled) {
                            setOldBlocks(null);
                            setNewBlocks(null);
                        }
                    } else {
                        const [previous, selected] = await Promise.all([
                            fetchCheckpointBlocks(
                                documentId,
                                previousCheckpointId,
                            ),
                            fetchCheckpointBlocks(
                                documentId,
                                selectedCheckpointId,
                            ),
                        ]);
                        if (cancelled) return;
                        setOldBlocks(previous);
                        setNewBlocks(selected);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(
                        "useCheckpointDiff: failed to load checkpoint content:",
                        err,
                    );
                    setOldBlocks(null);
                    setNewBlocks(null);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [documentId, selectedCheckpointId, previousCheckpointId, diffType]);

    // Derives the unified diff from the fetched/live state — no extra effect or state
    // needed, since this recomputes automatically whenever any dependency changes.
    const entries = useMemo((): UnifiedBlockEntry[] => {
        if (!oldBlocks) return [];
        if (diffType === "selectedVsCurrent") {
            if (!editor) return [];
            return buildUnifiedDiff(oldBlocks, editor.document);
        }
        if (!newBlocks) return [];
        return buildUnifiedDiff(oldBlocks, newBlocks);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [oldBlocks, newBlocks, diffType, editor, liveDocVersion]);

    return { entries, isLoading };
};

export default useCheckpointDiff;
