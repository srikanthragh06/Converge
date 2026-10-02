import { useCallback, useEffect, useState } from "react";
import { type BlockNoteEditor } from "@blocknote/core";
import { WRITE_LOCK_STORAGE_PREFIX } from "@/lib/constants";

/** Reads the persisted write-lock flag for a single document. */
const readWriteLock = (documentId: number) =>
    localStorage.getItem(`${WRITE_LOCK_STORAGE_PREFIX}${documentId}`) ===
    "true";

/**
 * Tracks a per-document, per-browser "write lock" toggle. This is a local
 * comfort feature only: it disables editing for this user in this browser,
 * has no server-side effect, and does not change the user's actual access
 * level or affect any other user's ability to write. Persisted in
 * localStorage keyed by document ID so it survives reloads. Also applies the
 * resulting editability to the editor.
 * @param documentId - the open document
 * @param editor - the document's editor, or null before it is created
 * @param isEditable - whether the user's resolved access allows writing
 */
const useWriteLock = (
    documentId: number | undefined,
    editor: BlockNoteEditor | null,
    isEditable: boolean,
) => {
    const [trackedDocumentId, setTrackedDocumentId] = useState(documentId); // documentId the current isWriteLocked value was derived from
    const [isWriteLocked, setIsWriteLocked] = useState(
        () => documentId !== undefined && readWriteLock(documentId),
    );

    /** Flips the write lock for the current document and persists the new state. */
    const toggleWriteLock = useCallback(() => {
        if (documentId === undefined) return;

        setIsWriteLocked((prev) => {
            const next = !prev;
            const key = `${WRITE_LOCK_STORAGE_PREFIX}${documentId}`;

            if (next) {
                localStorage.setItem(key, "true");
            } else {
                localStorage.removeItem(key);
            }

            return next;
        });
    }, [documentId]);

    useEffect(() => {
        // Reload the lock state whenever the open document changes.
        if (documentId !== trackedDocumentId) {
            setTrackedDocumentId(documentId);
            setIsWriteLocked(
                documentId !== undefined && readWriteLock(documentId),
            );
        }
    }, [documentId]);

    const canWrite = isEditable && !isWriteLocked; // combines resolved access with the local write lock to gate actual editing

    // Set editability on the editor directly instead of via BlockNoteView's
    // `editable` prop: a prop change makes BlockNote unmount and remount the
    // editor DOM, which empties the scroll container and resets its scroll to
    // the top. setEditable updates the existing view in place. Called as a
    // method, since assigning `editor.isEditable` trips
    // react-hooks/immutability. Must stay a useEffect (not useLayoutEffect)
    // so it runs after BlockNoteView's own mount effect, which sets the editor
    // editable.
    useEffect(() => {
        if (editor && editor.isEditable !== canWrite)
            editor._tiptapEditor.setEditable(canWrite);
    }, [editor, canWrite]);

    return { isWriteLocked, toggleWriteLock, canWrite };
};

export default useWriteLock;
