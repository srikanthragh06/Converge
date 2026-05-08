import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../lib/http";
import { isValidEmail } from "../utils/utils";
import type {
    DocumentAccessUserDto,
    FindNewDocumentAccessUserResponseDto,
    GetDocumentAccessResponseDto,
    SearchDocumentAccessUsersResponseDto,
} from "@converge/shared";

const ACCESS_LIST_LIMIT = 20;

/**
 * Manages ManageAccessTab state. When email is empty, fetches the first page
 * of the access list on mount and loads subsequent pages via infinite scroll
 * (IntersectionObserver on sentinelRef). When email is non-empty (debounced
 * 300 ms), fires both the find-new and search endpoints — find-new resolves a
 * new user to add, search filters the existing access list without pagination.
 */
const useManageAccessTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const [email, setEmail] = useState(""); // current email search query
    const [existingUsers, setExistingUsers] = useState<DocumentAccessUserDto[]>(
        [],
    ); // accumulated access list; replaced on search, appended on loadMore
    const [foundUser, setFoundUser] =
        useState<FindNewDocumentAccessUserResponseDto | null>(null); // user resolved by exact email who has no access yet
    const [isExistingUsersLoading, setIsExistingUsersLoading] = useState(false); // true while the first page or search fetch is in flight
    const [isFetchingMore, setIsFetchingMore] = useState(false); // true while a subsequent page is loading
    const [isFindNewUserLoading, setIsFindNewUserLoading] = useState(false); // true while the find-new fetch is in flight
    const [isFindNewUserConflict, setIsFindNewUserConflict] = useState(false); // true when find-new returns 409 (user is owner or already has access)

    const nextCursorRef = useRef<number | null>(null); // keyset cursor for the next page; null when no more pages exist
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore always reads the latest value without being in deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts or unmounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /**
     * Fetches the first page of the access list and resets all pagination state.
     * Also clears any stale conflict flag from a prior find-new call.
     */
    const fetchAccessList = async (docId: string) => {
        try {
            setIsFindNewUserConflict(false);
            setIsExistingUsersLoading(true);
            const { data } = await apiClient.get<GetDocumentAccessResponseDto>(
                `/document-access/${docId}`,
                { params: { limit: ACCESS_LIST_LIMIT } },
            );
            setExistingUsers(data.users);
            nextCursorRef.current = data.nextCursor;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error("ManageAccessTab: failed to fetch access list:", err);
        } finally {
            setIsExistingUsersLoading(false);
        }
    };

    /**
     * Fetches the next page and appends it to existingUsers. No-ops when a
     * fetch is already in flight, there are no more pages, or no cursor exists.
     */
    const loadMore = async () => {
        if (
            !documentId ||
            isFetchingMore ||
            !hasMoreRef.current ||
            nextCursorRef.current === null
        )
            return;

        try {
            setIsFetchingMore(true);
            const { data } = await apiClient.get<GetDocumentAccessResponseDto>(
                `/document-access/${documentId}`,
                {
                    params: {
                        limit: ACCESS_LIST_LIMIT,
                        cursorId: nextCursorRef.current,
                    },
                },
            );
            setExistingUsers((prev) => [...prev, ...data.users]);
            nextCursorRef.current = data.nextCursor;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error(
                "ManageAccessTab: failed to load more access users:",
                err,
            );
        } finally {
            setIsFetchingMore(false);
        }
    };

    /** Searches existing access users by email using fuzzy matching. Pagination is disabled in search mode. */
    const fetchSearchResults = async (docId: string, query: string) => {
        try {
            setIsFindNewUserConflict(false);
            setIsExistingUsersLoading(true);
            const { data } =
                await apiClient.get<SearchDocumentAccessUsersResponseDto>(
                    `/document-access/${docId}/search`,
                    { params: { email: query } },
                );
            setExistingUsers(data.users);
            // Search results are not paginated.
            nextCursorRef.current = null;
            hasMoreRef.current = false;
        } catch (err) {
            console.error(
                "ManageAccessTab: failed to search access users:",
                err,
            );
        } finally {
            setIsExistingUsersLoading(false);
        }
    };

    /** Looks up a user by exact email who does not yet have access. */
    const fetchFindNew = async (docId: string, query: string) => {
        try {
            setIsFindNewUserLoading(true);
            setIsFindNewUserConflict(false);
            const { data } =
                await apiClient.get<FindNewDocumentAccessUserResponseDto>(
                    `/document-access/${docId}/find-new`,
                    { params: { email: query } },
                );
            setFoundUser(data);
        } catch (err: any) {
            setFoundUser(null);
            // 409 means the user is the document owner or already has access assigned.
            setIsFindNewUserConflict(err?.response?.status === 409);
        } finally {
            setIsFindNewUserLoading(false);
        }
    };

    // Switches between full paginated list and email-driven fetches depending on email state.
    // When email is empty, resets find state and fetches the first page of the full list.
    // When non-empty, debounces 300 ms then fires find-new and search independently (no pagination).
    useEffect(() => {
        if (!documentId) return;

        if (email.trim() === "") {
            setFoundUser(null);
            setIsFindNewUserConflict(false);
            fetchAccessList(documentId);
            return;
        }

        const timeout = setTimeout(() => {
            if (isValidEmail(email.trim()))
                fetchFindNew(documentId, email.trim());
            fetchSearchResults(documentId, email.trim());
        }, 300);

        return () => clearTimeout(timeout);
    }, [documentId, email]);

    // Observes the sentinel element and calls loadMore when it enters the viewport.
    // Depends on sentinelEl so it re-runs once the sentinel actually mounts.
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
        email,
        setEmail,
        existingUsers,
        setExistingUsers,
        foundUser,
        setFoundUser,
        isExistingUsersLoading,
        isFetchingMore,
        isFindNewUserLoading,
        isFindNewUserConflict,
        sentinelRef,
    };
};

export default useManageAccessTab;
