import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { BlockNoteEditor } from "@blocknote/core";
import {
    SOCKET_EVENTS,
    AwarenessUpdateServerSchema,
    AwarenessUpdateClientSchema,
    GetAwarenessUpdateSchema,
} from "@converge/shared";
import { socket } from "../lib/socket";
import { socketEmit } from "../lib/socket-emit.util";
import { socketReceive } from "../lib/socket-receive.util";
import { isSocketReadyAtom, awarenessAtom } from "../atoms/socket";

/**
 * Manages awareness for the current user and the document's presence list.
 * Emits AWARENESS_UPDATE_SERVER when the user's focused block changes or the
 * editor loses focus. Listens for AWARENESS_UPDATE_CLIENT and writes the full
 * user list into awarenessAtom. Clears the atom on disconnect.
 * Both effects gate on isSocketReadyAtom per project convention.
 *
 * @param editor - the BlockNote editor instance, or null while the document is loading
 */
const useAwareness = (editor: BlockNoteEditor | null) => {
    const isSocketReady = useAtomValue(isSocketReadyAtom);
    const [awareness, setAwareness] = useAtom(awarenessAtom);

    // Emits the user's focused block to the server on selection and blur events.
    // Re-runs when the editor instance or socket readiness changes.
    useEffect(() => {
        if (!editor || !isSocketReady) return;

        // Emit the focused block ID on every cursor movement.
        const removeSelectionListener = editor.onSelectionChange(() => {
            const { block } = editor.getTextCursorPosition();
            socketEmit(
                socket,
                SOCKET_EVENTS.AWARENESS_UPDATE_SERVER,
                AwarenessUpdateServerSchema,
                { focusedBlockId: block.id },
            );
        });

        // TipTap's blur fires spuriously during internal focus transitions, so
        // isFocused() is checked to confirm the editor truly lost focus before
        // emitting null.
        const handleBlur = () => {
            if (!editor.isFocused()) {
                socketEmit(
                    socket,
                    SOCKET_EVENTS.AWARENESS_UPDATE_SERVER,
                    AwarenessUpdateServerSchema,
                    { focusedBlockId: null },
                );
            }
        };

        editor._tiptapEditor.on("blur", handleBlur);

        return () => {
            removeSelectionListener();
            editor._tiptapEditor.off("blur", handleBlur);
        };
    }, [editor, isSocketReady]);

    // Listens for awareness state broadcasts and keeps awarenessAtom up to date.
    // Clears the atom when the socket disconnects so stale presence data is not shown.
    // Re-runs when socket readiness changes.
    useEffect(() => {
        if (!isSocketReady) {
            setAwareness([]);
            return;
        }

        // Request current state immediately so presence is populated without
        // waiting for another user's cursor movement to trigger a broadcast.
        socketEmit(
            socket,
            SOCKET_EVENTS.GET_AWARENESS_UPDATE,
            GetAwarenessUpdateSchema,
            {},
        );

        const handleAwarenessUpdateClient = (data: unknown) => {
            const res = socketReceive(AwarenessUpdateClientSchema, data);
            if (!res) return;
            setAwareness(res.users);
        };

        socket.on(
            SOCKET_EVENTS.AWARENESS_UPDATE_CLIENT,
            handleAwarenessUpdateClient,
        );

        return () => {
            socket.off(
                SOCKET_EVENTS.AWARENESS_UPDATE_CLIENT,
                handleAwarenessUpdateClient,
            );
        };
    }, [isSocketReady]);
};

export default useAwareness;
