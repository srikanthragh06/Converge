import { BlockNoteEditor } from "@blocknote/core";
import { useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { socket } from "../lib/socket";
import { useAtomValue } from "jotai";
import { isSocketConnectedAtom } from "../atoms/atoms";

const useEditor = () => {
    const isSocketConnected = useAtomValue(isSocketConnectedAtom);

    const timeoutIdRef = useRef<number | null>(null);
    const pendingUpdatesRef = useRef<Uint8Array<ArrayBufferLike>[]>([]);

    const yDoc = useMemo(() => new Y.Doc(), []);

    const editor = useMemo(() => {
        return BlockNoteEditor.create({
            // Stub collaboration config to wire up the Y.Doc fragment. Provider
            // and user identity will be replaced once the WebSocket sync provider
            // is connected.
            collaboration: {
                fragment: yDoc.getXmlFragment("blocknote"),
                provider: {},
                user: { name: "", color: "" },
            },
            // Override the default paste handler so that plain-text pastes are
            // interpreted as Markdown rather than inserted as a literal string.
            pasteHandler: ({ event, editor: e, defaultPasteHandler }) => {
                if (event.clipboardData?.types.includes("text/plain")) {
                    e.pasteMarkdown(event.clipboardData.getData("text/plain"));
                    return true;
                }

                return defaultPasteHandler();
            },
        });
    }, []);

    useEffect(() => {
        if (!isSocketConnected) return;

        const handleNewUserUpdate = (
            update: Uint8Array<ArrayBufferLike>,
            origin: string,
        ) => {
            if (origin === "REMOTE") return;

            // Debounce rapid keystrokes into a single emission. clientSV lets
            // the server detect and send back any updates the client has missed.
            pendingUpdatesRef.current.push(update);
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = setTimeout(() => {
                const mergedUpdate = Y.mergeUpdates(pendingUpdatesRef.current);
                pendingUpdatesRef.current = [];
                const clientSV = Y.encodeStateVector(yDoc);
                socket.emit("sync-doc", { update: mergedUpdate, clientSV });
            }, 300);
        };

        yDoc.on("update", handleNewUserUpdate);

        return () => {
            yDoc.off("update", handleNewUserUpdate);
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        };
    }, [yDoc, isSocketConnected]);

    return { editor };
};

export default useEditor;
