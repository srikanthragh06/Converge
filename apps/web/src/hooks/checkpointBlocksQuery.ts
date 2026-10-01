import { queryOptions } from "@tanstack/react-query";
import * as Y from "yjs";
import { BlockNoteEditor } from "@blocknote/core";
import {
    editorSchema,
    type GetDocumentCheckpointContentResponseDto,
} from "@converge/shared";
import apiClient from "../lib/http";
import { checkpointKeys } from "../queries/checkpoints";
import {
    base64ToUint8Array,
    type DocBlock,
} from "../utils/checkpointDiffUtils";

/**
 * Query for one checkpoint's content as BlockNote blocks, shared by the diff
 * (useQuery) and restore (fetchQuery), so a checkpoint is fetched and decoded
 * once. Decoding applies the checkpoint's Yjs update to a scratch Y.Doc,
 * then mounts a throwaway BlockNoteEditor to a detached (never-appended) div
 * purely to trigger the collaboration binding's initial sync into
 * .document. A checkpoint never changes, so the result never goes stale.
 * @param documentId - document the checkpoint belongs to
 * @param checkpointId - checkpoint to fetch and decode
 */
const checkpointBlocksQuery = (documentId: number, checkpointId: number) =>
    queryOptions({
        queryKey: checkpointKeys.content(documentId, checkpointId),
        queryFn: async (): Promise<DocBlock[]> => {
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
        },
        staleTime: Infinity,
    });

export default checkpointBlocksQuery;
