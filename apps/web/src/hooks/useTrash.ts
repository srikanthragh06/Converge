import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtom, useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { documentKeys } from "../queries/documents";
import useToast from "./useToast";
import type {
    GetTrashDocumentsResponseDto,
    TrashDocumentDto,
} from "@converge/shared";
import { currentWorkspaceAtom, refreshSidebarAtom } from "../atoms/sidebar";

const TRASH_PAGE_LIMIT = 12;

/**
 * Manages the Trash page's state. Fetches soft-deleted documents from
 * GET /document/trash with keyset pagination and an IntersectionObserver on
 * the returned sentinelRef to automatically load the next page on scroll —
 * mirrors useLibrary's pagination pattern. Also exposes restoreDocument,
 * which calls POST /document/:id/restore, removes the restored document from
 * the local list, and shows a toast with an Open action.
 * @param filterText - filters the list by title. The server has no trash
 * search, so this filters on the client — and while a filter is set, the
 * remaining pages are loaded one after another so no match is missed.
 */
const useTrash = (filterText: string) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // active workspace — its ID is required by all trash API calls
    const [refreshSidebar, setRefreshSidebar] = useAtom(refreshSidebarAtom); // bumped when a document is trashed or restored anywhere, so the list re-fetches; bumped here on restore so the sidebar regains the document
    const [documents, setDocuments] = useState<TrashDocumentDto[]>([]); // accumulated list of fetched trashed documents
    const [isLoadingMore, setIsLoadingMore] = useState(true); // true when a trash fetch is in flight; starts true since the first page is fetched on mount
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
     * Restores a trashed document via POST /document/:id/restore, drops it
     * from the local list so it disappears at once, refreshes the sidebar,
     * and shows a toast whose Open action opens the restored document.
     * Failures are reported with a toast.
     * @param doc - the document to restore
     */
    const restoreDocument = async (doc: TrashDocumentDto) => {
        setRestoringId(doc.id);
        try {
            await apiClient.post(`/document/${doc.id}/restore`);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            setRefreshSidebar((prev) => prev + 1);
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
            showToast(`Restored "${doc.title || "Untitled"}"`, {
                action: {
                    label: "Open",
                    onClick: () => navigate(`/document/${doc.id}`),
                },
            });
        } catch (err) {
            console.error("useTrash: failed to restore document:", err);
            showToast("Couldn't restore the document", { tone: "error" });
        } finally {
            setRestoringId(null);
        }
    };

    // Fetches the first page on mount, when the current workspace changes,
    // and when a document menu bumps refreshSidebarAtom (a document was
    // trashed or restored elsewhere).
    useEffect(() => {
        fetchFirstPage();
    }, [currentWorkspace, refreshSidebar]);

    const query = filterText.trim().toLowerCase(); // normalized filter; empty means no filter

    // While a filter is set, keeps loading pages until none are left, so
    // the client-side filter sees the whole trash. Re-runs after each page,
    // since isLoadingMore flips back to false.
    useEffect(() => {
        if (query && !isLoadingMore && hasMoreRef.current) loadMore();
    }, [query, isLoadingMore]);

    // The loaded documents whose title contains the filter.
    const visibleDocuments = query
        ? documents.filter((d) =>
              (d.title || "Untitled").toLowerCase().includes(query),
          )
        : documents;

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
        documents: visibleDocuments,
        isLoadingMore,
        sentinelRef,
        restoringId,
        restoreDocument,
    };
};

export default useTrash;
