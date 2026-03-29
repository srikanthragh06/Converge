import { BlockNoteEditor } from "@blocknote/core";
import { useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { socket } from "../lib/socket";
import { useAtomValue } from "jotai";
import { isSocketConnectedAtom } from "../atoms/atoms";
import { mapsAreEqual } from "../utils/utils";

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
                socket.emit("sync-doc", {
                    update: Array.from(mergedUpdate),
                    clientSV: Array.from(clientSV),
                });
            }, 300);
        };

        yDoc.on("update", handleNewUserUpdate);

        return () => {
            yDoc.off("update", handleNewUserUpdate);
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        };
    }, [yDoc, isSocketConnected]);

    useEffect(() => {
        if (!isSocketConnected) return;

        const initiateRepairSync = () => {
            const clientSV = Y.encodeStateVector(yDoc);
            socket.emit("repair-sync-doc", { clientSV: Array.from(clientSV) });
        };

        // Handles repair initiated by the server — respond with our diff and SV.
        const handleRepairSyncDoc = ({ serverSV }: { serverSV: number[] }) => {
            const serverSVBytes = new Uint8Array(serverSV);
            const diff = Y.encodeStateAsUpdate(yDoc, serverSVBytes);
            const clientSV = Y.encodeStateVector(yDoc);
            socket.emit("repair-sync-ack-doc", {
                diff: Array.from(diff),
                clientSV: Array.from(clientSV),
            });
        };

        // Applies the diff sent by the other side, then sends back our diff.
        const handleRepairSyncAckDoc = ({
            diff,
            serverSV,
        }: {
            diff: number[];
            serverSV: number[];
        }) => {
            Y.applyUpdate(yDoc, new Uint8Array(diff), "REMOTE");
            const diffForServer = Y.encodeStateAsUpdate(
                yDoc,
                new Uint8Array(serverSV),
            );
            const clientSV = Y.encodeStateVector(yDoc);
            socket.emit("repair-sync-ack-doc", {
                diff: Array.from(diffForServer),
                clientSV: Array.from(clientSV),
            });
        };

        // Final step — applies any remaining diff the other side computed for us.
        const handleRepairAckDoc = ({ diff }: { diff: number[] }) => {
            Y.applyUpdate(yDoc, new Uint8Array(diff), "REMOTE");
        };

        socket.on("repair-sync-doc", handleRepairSyncDoc);
        socket.on("repair-sync-ack-doc", handleRepairSyncAckDoc);
        socket.on("repair-ack-doc", handleRepairAckDoc);

        // Initiate repair on connect to pull any server state the client missed.
        initiateRepairSync();

        return () => {
            socket.off("repair-sync-doc", handleRepairSyncDoc);
            socket.off("repair-sync-ack-doc", handleRepairSyncAckDoc);
            socket.off("repair-ack-doc", handleRepairAckDoc);
        };
    }, [yDoc, isSocketConnected]);

    useEffect(() => {
        if (!isSocketConnected) return;

        const handleSyncDoc = ({
            update,
            serverSV,
        }: {
            update: number[];
            serverSV: number[];
        }) => {
            const updateBytes = new Uint8Array(update);
            const serverSVBytes = new Uint8Array(serverSV);

            Y.applyUpdate(yDoc, updateBytes, "REMOTE");

            const clientSV = Y.encodeStateVector(yDoc);

            if (
                !mapsAreEqual(
                    Y.decodeStateVector(serverSVBytes),
                    Y.decodeStateVector(clientSV),
                )
            ) {
                // if not same initiate repair
                socket.emit("repair-sync-doc", {
                    clientSV: Array.from(clientSV),
                });
            }
        };

        socket.on("sync-doc", handleSyncDoc);

        return () => {
            socket.off("sync-doc", handleSyncDoc);
        };
    }, [yDoc, isSocketConnected]);

    return { editor };
};

export default useEditor;
