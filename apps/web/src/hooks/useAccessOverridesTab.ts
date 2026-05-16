import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../lib/http";
import { isValidEmail, hasAccess } from "../utils/utils";
import type {
    DocumentAccessLevel,
    DocumentAccessUserDto,
    FindNewDocumentAccessUserResponseDto,
    GetDocumentAccessResponseDto,
    GetDocumentResponseDto,
    GetDocumentRoleOverridesResponseDto,
    ResolvedDocumentAccessLevel,
    SearchDocumentAccessUsersResponseDto,
    UpdateDocumentRoleOverridesResponseDto,
} from "@converge/shared";

const ACCESS_LIST_LIMIT = 20;

/**
 * Manages AccessOverridesTab state. On mount fetches the current user's
 * resolved access level and the document's per-role overrides in parallel.
 * Also manages the per-user access list with an email-driven search +
 * find-new + infinite-scroll pattern.
 */
const useAccessOverridesTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const [documentAccess, setDocumentAccess] =
        useState<ResolvedDocumentAccessLevel | null>(null); // current user's resolved access; null while loading
    const [isAccessLoading, setIsAccessLoading] = useState(false); // true while the access fetch is in flight

    const [roleOverrides, setRoleOverrides] =
        useState<GetDocumentRoleOverridesResponseDto | null>(null); // fetched role overrides + workspace defaults; null while loading
    const [isRoleOverridesLoading, setIsRoleOverridesLoading] = useState(false); // true while the role-overrides GET is in flight
    const [isSavingRole, setIsSavingRole] = useState(false); // true while a PUT role-overrides request is in flight

    const [email, setEmail] = useState(""); // current email search query
    const [existingUsers, setExistingUsers] = useState<DocumentAccessUserDto[]>(
        [],
    ); // accumulated access list; replaced on search, appended on loadMore
    const [foundUser, setFoundUser] =
        useState<FindNewDocumentAccessUserResponseDto | null>(null); // user resolved by exact email who has no access yet
    const [isExistingUsersLoading, setIsExistingUsersLoading] = useState(false); // true while the first page or search fetch is in flight
    const [isFetchingMore, setIsFetchingMore] = useState(false); // true while a subsequent page is loading
    const [isFindNewUserLoading, setIsFindNewUserLoading] = useState(false); // true while the find-new fetch is in flight
    const [isFindNewUserConflict, setIsFindNewUserConflict] = useState(false); // true when find-new returns 409 (user is already the owner or has access)

    const canManage =
        documentAccess !== null && hasAccess(documentAccess, "admin"); // only admins and above may edit overrides or add users

    const nextCursorRef = useRef<number | null>(null); // keyset cursor for the next page; null when no more pages exist
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore reads the latest value without being in deps
    const canManageRef = useRef(false); // ref mirror of canManage — lets the email effect read the latest value without listing canManage as a dep
    canManageRef.current = canManage;

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts or unmounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    // Fetches the current user's resolved access level and the per-role overrides in parallel on mount.
    useEffect(() => {
        if (!documentId) return;

        /** Fetches the current user's resolved access level to gate editing. */
        const fetchDocumentAccess = async () => {
            try {
                setIsAccessLoading(true);
                const { data } = await apiClient.get<GetDocumentResponseDto>(
                    `/document/id/${documentId}`,
                );
                setDocumentAccess(data.resolvedAccess);
            } catch (err) {
                console.error(
                    "useAccessOverridesTab: failed to fetch document access:",
                    err,
                );
            } finally {
                setIsAccessLoading(false);
            }
        };

        /** Fetches per-role overrides together with workspace defaults and the workspace name. */
        const fetchRoleOverrides = async () => {
            try {
                setIsRoleOverridesLoading(true);
                const { data } =
                    await apiClient.get<GetDocumentRoleOverridesResponseDto>(
                        `/document-access/${documentId}/role-overrides`,
                    );
                setRoleOverrides(data);
            } catch (err) {
                console.error(
                    "useAccessOverridesTab: failed to fetch role overrides:",
                    err,
                );
            } finally {
                setIsRoleOverridesLoading(false);
            }
        };

        fetchDocumentAccess();
        fetchRoleOverrides();
    }, [documentId]);

    /**
     * Sends a PUT with a single field to update one role override. Passing null
     * resets that role to the workspace default. Merges the response back into
     * local state so the other two fields are preserved.
     */
    const updateRoleOverride = async (
        field: "adminDocAccess" | "memberDocAccess" | "nonMemberDocAccess",
        value: DocumentAccessLevel | null,
    ) => {
        if (!documentId) return;
        try {
            setIsSavingRole(true);
            const { data } =
                await apiClient.put<UpdateDocumentRoleOverridesResponseDto>(
                    `/document-access/${documentId}/role-overrides`,
                    { [field]: value },
                );
            setRoleOverrides((prev) => (prev ? { ...prev, ...data } : prev));
        } catch (err) {
            console.error(
                "useAccessOverridesTab: failed to update role override:",
                err,
            );
        } finally {
            setIsSavingRole(false);
        }
    };

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
            console.error(
                "useAccessOverridesTab: failed to fetch access list:",
                err,
            );
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
                "useAccessOverridesTab: failed to load more access users:",
                err,
            );
        } finally {
            setIsFetchingMore(false);
        }
    };

    /** Searches existing access users by fuzzy email match. Pagination is disabled in search mode. */
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
            nextCursorRef.current = null;
            hasMoreRef.current = false;
        } catch (err) {
            console.error(
                "useAccessOverridesTab: failed to search access users:",
                err,
            );
        } finally {
            setIsExistingUsersLoading(false);
        }
    };

    /** Looks up a user by exact email who does not yet have an access row. Only called for admin+ callers. */
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
            // 409 means the user is the document owner or already has an explicit access row.
            setIsFindNewUserConflict(err?.response?.status === 409);
        } finally {
            setIsFindNewUserLoading(false);
        }
    };

    // Switches between full paginated list and email-driven fetches depending on email state.
    // When email is empty, resets find state and fetches the first page of the full list.
    // When non-empty, debounces 300 ms then fires search and, for admin+ callers, find-new.
    useEffect(() => {
        if (!documentId) return;

        if (email.trim() === "") {
            setFoundUser(null);
            setIsFindNewUserConflict(false);
            fetchAccessList(documentId);
            return;
        }

        const timeout = setTimeout(() => {
            if (canManageRef.current && isValidEmail(email.trim()))
                fetchFindNew(documentId, email.trim());
            fetchSearchResults(documentId, email.trim());
        }, 300);

        return () => clearTimeout(timeout);
        // canManage intentionally omitted — read via canManageRef to avoid a
        // spurious second fetchAccessList when the access fetch resolves on mount.
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
        documentAccess,
        isAccessLoading,
        roleOverrides,
        isRoleOverridesLoading,
        isSavingRole,
        updateRoleOverride,
        canManage,
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

export default useAccessOverridesTab;
