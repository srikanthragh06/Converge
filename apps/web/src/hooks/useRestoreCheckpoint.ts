import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { BlockNoteEditor } from "@blocknote/core";
import apiClient from "../lib/http";
import { editorSchema, type GetDocumentCheckpointContentResponseDto } from "@converge/shared";
import {
    base64ToUint8Array,
    type DocBlock,
    type EditorInstance,
} from "../utils/checkpointDiffUtils";

/** How long the success/error status stays before automatically reverting to idle. */
const TRANSIENT_STATUS_DISPLAY_MS = 2000;

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
 * Returns a restoreCheckpoint function that overwrites the live document's
 * content with a past checkpoint's content, and the status of the most
 * recent attempt so the caller can render a loading/success/error state.
 * Fetches and decodes the checkpoint's blocks, then applies them to the live
 * editor via editor.replaceBlocks — this produces normal Yjs transactions
 * that flow through the existing collaboration sync pipeline (persisted,
 * broadcast to other connected clients, and access-checked server-side)
 * exactly like a manual edit, so no dedicated restore endpoint is needed.
 * No-ops if a request is already in flight, documentId is not yet
 * available, or the live editor has not mounted yet. A success or error
 * status automatically reverts to idle after TRANSIENT_STATUS_DISPLAY_MS.
 * @param documentId - the document whose live content to overwrite
 * @param editor - the live editor instance to write the restored content into
 */
const useRestoreCheckpoint = (
    documentId: string | undefined,
    editor: EditorInstance | null,
) => {
    const [status, setStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle"); // status of the most recent restore attempt

    // Auto-reverts a success/error status back to idle after
    // TRANSIENT_STATUS_DISPLAY_MS. Cleared if status changes again (a new
    // attempt) or the component unmounts before the timeout fires, so it
    // never fires a stale revert.
    useEffect(() => {
        if (status !== "success" && status !== "error") return;
        const timeoutId = setTimeout(
            () => setStatus("idle"),
            TRANSIENT_STATUS_DISPLAY_MS,
        );
        return () => clearTimeout(timeoutId);
    }, [status]);

    /** Fetches the checkpoint's content and writes it into the live editor, updating status based on the outcome. */
    const restoreCheckpoint = useCallback(
        async (checkpointId: number) => {
            if (status === "loading" || !documentId || !editor) return;
            try {
                setStatus("loading");
                const blocks = await fetchCheckpointBlocks(
                    documentId,
                    checkpointId,
                );
                editor.replaceBlocks(editor.document, blocks);
                setStatus("success");
            } catch (err) {
                console.error(
                    "useRestoreCheckpoint: failed to restore checkpoint",
                    err,
                );
                setStatus("error");
            }
        },
        [status, documentId, editor],
    );

    return { restoreCheckpoint, status };
};

export default useRestoreCheckpoint;
