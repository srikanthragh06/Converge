import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import apiClient from "../lib/http";
import type {
    GetTrashDocumentsResponseDto,
    TrashDocumentDto,
} from "@converge/shared";
import { currentWorkspaceAtom } from "../atoms/sidebar";

const TRASH_PAGE_LIMIT = 12;

/**
 * Manages the Trash tab's state. Fetches soft-deleted documents from
 * GET /document/trash with keyset pagination and an IntersectionObserver on
 * the returned sentinelRef to automatically load the next page on scroll —
 * mirrors useLibrary's pagination pattern, minus search. Also exposes
 * restoreDocument, which calls POST /document/:id/restore and removes the
 * restored document from the local list on success.
 * @param enabled - only fetches while true, so switching to the Trash tab
 * is what actually triggers the request rather than every Library page
 * mount fetching a list most users will never look at. Re-fetches the
 * first page each time it flips from false to true, so reopening the tab
 * shows the current state rather than a stale snapshot.
 */
const useTrash = (enabled: boolean) => {
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // active workspace — its ID is required by all trash API calls
    const [documents, setDocuments] = useState<TrashDocumentDto[]>([]); // accumulated list of fetched trashed documents
    const [isLoadingMore, setIsLoadingMore] = useState(false); // true when a trash fetch is in flight; starts false since enabled starts false
    const [restoringId, setRestoringId] = useState<number | null>(null); // ID of the document currently being restored, if any

    const nextCursor = useRef<{ deletedAt: Date; id: number } | null>(null); // compound keyset cursor for the next page
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore always reads the latest value without needing to be in its deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /** Fetches the first page of the workspace's trash and resets pagination state. */
    const fetchFirstPage = async () => {
        if (!currentWorkspace) {
            setIsLoadingMore(false);
            return;
        }
        try {
            setIsLoadingMore(true);
            const { data } = await apiClient.get<GetTrashDocumentsResponseDto>(
                "/document/trash",
                {
                    params: {
                        workspaceId: currentWorkspace.id,
                        limit: TRASH_PAGE_LIMIT,
                    },
                },
            );
            setDocuments(data.documents);
            nextCursor.current = data.nextCursor
                ? {
                      id: data.nextCursor.id,
                      deletedAt: new Date(data.nextCursor.deletedAt),
                  }
                : null;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    /**
     * Fetches the next page of trashed documents and appends them to the list.
     * No-ops if a fetch is already in flight or there are no more pages.
     */
    const loadMore = async () => {
        if (
            !currentWorkspace ||
            isLoadingMore ||
            !hasMoreRef.current ||
            !nextCursor.current
        )
            return;

        try {
            setIsLoadingMore(true);
            const { data } = await apiClient.get<GetTrashDocumentsResponseDto>(
                "/document/trash",
                {
                    params: {
                        workspaceId: currentWorkspace.id,
                        limit: TRASH_PAGE_LIMIT,
                        cursorDeletedAt:
                            nextCursor.current.deletedAt.toISOString(),
                        cursorId: nextCursor.current.id,
                    },
                },
            );

            setDocuments((prev) => [...prev, ...data.documents]);
            nextCursor.current = data.nextCursor
                ? {
                      id: data.nextCursor.id,
                      deletedAt: new Date(data.nextCursor.deletedAt),
                  }
                : null;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    /**
     * Restores a trashed document via POST /document/:id/restore and drops
     * it from the local list on success, so it disappears from the Trash
     * tab without needing a refetch.
     * @param documentId - the document to restore
     */
    const restoreDocument = async (documentId: number) => {
        setRestoringId(documentId);
        try {
            await apiClient.post(`/document/${documentId}/restore`);
            setDocuments((prev) => prev.filter((d) => d.id !== documentId));
        } catch (err) {
            console.error("useTrash: failed to restore document:", err);
        } finally {
            setRestoringId(null);
        }
    };

    // Fetches the first page whenever the tab becomes enabled, or the current
    // workspace changes while it's already enabled. No-ops while disabled, so
    // switching to the Trash tab is what triggers the request.
    useEffect(() => {
        if (enabled) fetchFirstPage();
    }, [enabled, currentWorkspace]);

    // Observes the sentinel element and calls loadMore when it enters the viewport.
    // Depends on sentinelEl so it re-runs once the element actually mounts.
    useEffect(() => {
        if (!sentinelEl) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) loadMore();
            },
            { threshold: 0.1 },
        );

        observer.observe(sentinelEl);
        return () => observer.disconnect();
    }, [sentinelEl, loadMore]);

    return {
        documents,
        isLoadingMore,
        sentinelRef,
        restoringId,
        restoreDocument,
    };
};

export default useTrash;
