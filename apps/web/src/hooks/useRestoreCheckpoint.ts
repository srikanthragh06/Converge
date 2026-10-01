import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import checkpointBlocksQuery from "./checkpointBlocksQuery";
import type { EditorInstance } from "../utils/checkpointDiffUtils";

/** How long the success/error status stays before automatically reverting to idle. */
const TRANSIENT_STATUS_DISPLAY_MS = 2000;

/**
 * Overwrites the live document's content with a past checkpoint's content.
 * Loads the checkpoint's blocks (from the cache when the diff already did),
 * then applies them to the live editor via editor.replaceBlocks — this
 * produces normal Yjs transactions that flow through the existing
 * collaboration sync pipeline (persisted, broadcast to other connected
 * clients, and access-checked server-side) exactly like a manual edit, so no
 * dedicated restore endpoint is needed. `status` drives the button's
 * loading/success/error state; a success or error reverts to idle after
 * TRANSIENT_STATUS_DISPLAY_MS. A failure shows the global error toast.
 * @param documentId - the document whose live content to overwrite
 * @param editor - the live editor instance to write the restored content into
 */
const useRestoreCheckpoint = (
    documentId: string | undefined,
    editor: EditorInstance | null,
) => {
    const queryClient = useQueryClient();

    const { mutate, status, reset } = useMutation({
        mutationFn: async ({
            editor,
            checkpointId,
        }: {
            editor: EditorInstance;
            checkpointId: number;
        }) => {
            const blocks = await queryClient.fetchQuery(
                checkpointBlocksQuery(Number(documentId), checkpointId),
            );
            editor.replaceBlocks(editor.document, blocks);
        },
        meta: { errorMessage: "Couldn't restore the checkpoint" },
    });

    // Reverts a success/error status to idle after a moment.
    useEffect(() => {
        if (status !== "success" && status !== "error") return;
        const timeoutId = setTimeout(reset, TRANSIENT_STATUS_DISPLAY_MS);
        return () => clearTimeout(timeoutId);
    }, [status, reset]);

    return {
        // No-ops while a restore is in flight or before the editor mounts.
        restoreCheckpoint: (checkpointId: number) => {
            if (status !== "pending" && editor)
                mutate({ editor, checkpointId });
        },
        status: status === "pending" ? ("loading" as const) : status, // idle, loading, success or error
    };
};

export default useRestoreCheckpoint;
