import { useCallback, useEffect, useState } from "react";
import { WRITE_LOCK_STORAGE_PREFIX } from "../constants/constants";

/** Reads the persisted write-lock flag for a single document. */
const readWriteLock = (documentId: string) =>
    localStorage.getItem(`${WRITE_LOCK_STORAGE_PREFIX}${documentId}`) ===
    "true";

/**
 * Tracks a per-document, per-browser "write lock" toggle. This is a local
 * comfort feature only: it disables editing for this user in this browser,
 * has no server-side effect, and does not change the user's actual access
 * level or affect any other user's ability to write. Persisted in
 * localStorage keyed by document ID so it survives reloads.
 */
const useWriteLock = (documentId: string | undefined) => {
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

    return { isWriteLocked, toggleWriteLock };
};

export default useWriteLock;
