import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import {
    AccessChangedSchema,
    AccessRevokedSchema,
    SOCKET_EVENTS,
    type GetDocumentResponseDto,
} from "@converge/shared";
import { socket } from "@/lib/socket";
import { hasAccess } from "@/lib/utils";
import { socketReceive } from "@/lib/socket-receive.util";
import { isSocketReadyAtom } from "@/atoms/socket";
import { documentKeys } from "@/features/documents/queryKeys";
import useToast from "@/hooks/useToast";

/**
 * Applies mid-session access changes the server pushes to the open
 * document's socket. ACCESS_CHANGED swaps the new level into the cached
 * document, so isEditable re-derives and the editor flips to or from
 * read-only in place; dropping from editor to viewer also resets the Y.Doc,
 * since edits the server rejected would otherwise stay on screen, and shows
 * a toast. ACCESS_REVOKED (sent just before the server disconnects the
 * socket) marks the cached document noAccess, which useDocumentFetch reports
 * as forbidden — that shows the no-access screen and disconnects the socket
 * so it doesn't keep reconnecting.
 * @param documentId - the open document
 * @param resetYDoc - from useYjsSync; swaps in a fresh Y.Doc refilled from the server
 */
const useAccessChanges = (
    documentId: number | undefined,
    resetYDoc: () => void,
) => {
    const isSocketReady = useAtomValue(isSocketReadyAtom);
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    useEffect(() => {
        if (!isSocketReady || documentId === undefined) return;

        const detailKey = documentKeys.detail(documentId);

        // Swap the new level into the cached document, resetting local
        // content if write access was just lost.
        const handleAccessChanged = (data: unknown) => {
            const res = socketReceive(AccessChangedSchema, data);
            if (!res) return;

            const previous =
                queryClient.getQueryData<GetDocumentResponseDto>(detailKey);
            queryClient.setQueryData<GetDocumentResponseDto>(
                detailKey,
                (doc) => doc && { ...doc, resolvedAccess: res.accessLevel },
            );

            const lostWriteAccess =
                previous !== undefined &&
                hasAccess(previous.resolvedAccess, "editor") &&
                !hasAccess(res.accessLevel, "editor");
            if (lostWriteAccess) {
                resetYDoc();
                showToast(
                    "Your access changed to view only. Recent edits may not have been saved.",
                    { tone: "info" },
                );
            }
        };

        // Mark the cached document noAccess and refresh the lists it may have
        // dropped out of.
        const handleAccessRevoked = (data: unknown) => {
            if (!socketReceive(AccessRevokedSchema, data)) return;

            queryClient.setQueryData<GetDocumentResponseDto>(
                detailKey,
                (doc) => doc && { ...doc, resolvedAccess: "noAccess" },
            );
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        };

        socket.on(SOCKET_EVENTS.ACCESS_CHANGED, handleAccessChanged);
        socket.on(SOCKET_EVENTS.ACCESS_REVOKED, handleAccessRevoked);

        return () => {
            socket.off(SOCKET_EVENTS.ACCESS_CHANGED, handleAccessChanged);
            socket.off(SOCKET_EVENTS.ACCESS_REVOKED, handleAccessRevoked);
        };
    }, [isSocketReady, documentId, queryClient, showToast, resetYDoc]);
};

export default useAccessChanges;
