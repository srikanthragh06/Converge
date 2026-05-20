import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
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
    const setAwareness = useSetAtom(awarenessAtom);
    const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    ); // pending timer for debounced selection-change emits

    // Emits the user's focused block to the server on selection and blur events.
    // Selection emits are debounced to avoid flooding the server on every keystroke.
    // Re-runs when the editor instance or socket readiness changes.
    useEffect(() => {
        if (!editor || !isSocketReady) return;

        // Debounce cursor updates — 300 ms gives a responsive feel without excessive traffic.
        const removeSelectionListener = editor.onSelectionChange(() => {
            if (selectionDebounceRef.current !== null)
                clearTimeout(selectionDebounceRef.current);
            selectionDebounceRef.current = setTimeout(() => {
                selectionDebounceRef.current = null;
                const { block } = editor.getTextCursorPosition();
                socketEmit(
                    socket,
                    SOCKET_EVENTS.AWARENESS_UPDATE_SERVER,
                    AwarenessUpdateServerSchema,
                    { focusedBlockId: block.id },
                );
            }, 300);
        });

        // TipTap's blur fires spuriously during internal focus transitions, so
        // isFocused() is checked to confirm the editor truly lost focus before
        // emitting null. Cancel any pending debounced selection emit first so the
        // null update is not overwritten by a stale block ID 300 ms later.
        const handleBlur = () => {
            if (!editor.isFocused()) {
                if (selectionDebounceRef.current !== null) {
                    clearTimeout(selectionDebounceRef.current);
                    selectionDebounceRef.current = null;
                }
                selectionDebounceRef.current = setTimeout(() => {
                    selectionDebounceRef.current = null;
                    socketEmit(
                        socket,
                        SOCKET_EVENTS.AWARENESS_UPDATE_SERVER,
                        AwarenessUpdateServerSchema,
                        { focusedBlockId: null },
                    );
                }, 300);
            }
        };

        editor._tiptapEditor.on("blur", handleBlur);

        return () => {
            if (selectionDebounceRef.current !== null) {
                clearTimeout(selectionDebounceRef.current);
                selectionDebounceRef.current = null;
            }
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
