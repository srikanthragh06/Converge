import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../lib/http";
import { isValidEmail } from "../utils/utils";
import { hasWorkspaceRole } from "@converge/shared";
import type {
    WorkspaceMemberDto,
    FindNewWorkspaceUserResponseDto,
    GetWorkspaceMembersResponseDto,
    SearchWorkspaceMembersResponseDto,
    WorkspaceRole,
} from "@converge/shared";
import { useAtomValue } from "jotai";
import { workspacesAtom } from "../atoms/sidebar";

const MEMBERS_LIST_LIMIT = 20;

/**
 * Manages MembersTab state. When email is empty, fetches the first page of the
 * members list on mount and loads subsequent pages via infinite scroll
 * (IntersectionObserver on sentinelRef). When email is non-empty (debounced
 * 300 ms), fires search to filter existing members and, if the current user
 * has admin+ access, also fires find-new to resolve a new user to invite.
 */
const useMembersTab = ({ workspaceId }: { workspaceId: number }) => {
    const [email, setEmail] = useState(""); // current email search query
    const [members, setMembers] = useState<WorkspaceMemberDto[]>([]); // accumulated members list; replaced on search, appended on loadMore
    const [foundUser, setFoundUser] =
        useState<FindNewWorkspaceUserResponseDto | null>(null); // user resolved by exact email who is not yet a member
    const [isMembersLoading, setIsMembersLoading] = useState(false); // true while the first page or search fetch is in flight
    const [isFetchingMore, setIsFetchingMore] = useState(false); // true while a subsequent page is loading
    const [isFindNewUserLoading, setIsFindNewUserLoading] = useState(false); // true while the find-new fetch is in flight
    const [isFindNewUserConflict, setIsFindNewUserConflict] = useState(false); // true when find-new returns 409 (user is owner or already a member)

    const workspaces = useAtomValue(workspacesAtom);
    const currentUserRole: WorkspaceRole =
        workspaces.find((w) => w.id === workspaceId)?.role ?? "member";
    const canManage = hasWorkspaceRole(currentUserRole, "admin");

    const nextCursorRef = useRef<number | null>(null); // keyset cursor for the next page; null when no more pages exist
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore always reads the latest value without being in deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /**
     * Fetches the first page of the members list and resets pagination state.
     */
    const fetchMembersList = async () => {
        try {
            setIsFindNewUserConflict(false);
            setIsMembersLoading(true);
            // Fetch the first page of members.
            const { data } =
                await apiClient.get<GetWorkspaceMembersResponseDto>(
                    `/workspaces/${workspaceId}/members`,
                    { params: { limit: MEMBERS_LIST_LIMIT } },
                );
            setMembers(data.members);
            nextCursorRef.current = data.nextCursor;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error("useMembersTab: failed to fetch members:", err);
        } finally {
            setIsMembersLoading(false);
        }
    };

    /**
     * Fetches the next page and appends it to members. No-ops when a fetch
     * is already in flight, there are no more pages, or no cursor exists.
     */
    const loadMore = async () => {
        if (
            isFetchingMore ||
            !hasMoreRef.current ||
            nextCursorRef.current === null
        )
            return;

        try {
            setIsFetchingMore(true);
            // Fetch the next page using the keyset cursor from the previous page.
            const { data } =
                await apiClient.get<GetWorkspaceMembersResponseDto>(
                    `/workspaces/${workspaceId}/members`,
                    {
                        params: {
                            limit: MEMBERS_LIST_LIMIT,
                            cursorId: nextCursorRef.current,
                        },
                    },
                );
            // Append the new page to the existing list.
            setMembers((prev) => [...prev, ...data.members]);
            nextCursorRef.current = data.nextCursor;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error("useMembersTab: failed to load more members:", err);
        } finally {
            setIsFetchingMore(false);
        }
    };

    /**
     * Searches existing members by email using fuzzy matching. Pagination
     * is disabled in search mode.
     */
    const fetchSearchResults = async (query: string) => {
        try {
            setIsFindNewUserConflict(false);
            setIsMembersLoading(true);
            const { data } =
                await apiClient.get<SearchWorkspaceMembersResponseDto>(
                    `/workspaces/${workspaceId}/members/search`,
                    { params: { email: query } },
                );
            setMembers(data.members);
            // Search results replace the paginated list entirely.
            nextCursorRef.current = null;
            hasMoreRef.current = false;
        } catch (err) {
            console.error("useMembersTab: failed to search members:", err);
        } finally {
            setIsMembersLoading(false);
        }
    };

    /**
     * Looks up a user by exact email who is not yet a member. Only called
     * when the current user has admin+ access.
     */
    const fetchFindNew = async (query: string) => {
        try {
            setIsFindNewUserLoading(true);
            setIsFindNewUserConflict(false);
            const { data } =
                await apiClient.get<FindNewWorkspaceUserResponseDto>(
                    `/workspaces/${workspaceId}/findNewUser`,
                    { params: { email: query } },
                );
            setFoundUser(data);
        } catch (err: any) {
            setFoundUser(null);
            setIsFindNewUserConflict(err?.response?.status === 409);
        } finally {
            setIsFindNewUserLoading(false);
        }
    };

    // Switches between full paginated list and email-driven fetches depending
    // on email state. When email is empty, resets find state and fetches the
    // first page of the full list. When non-empty, debounces 300 ms then fires
    // search and, for admin+ users, find-new.
    useEffect(() => {
        if (email.trim() === "") {
            setFoundUser(null);
            setIsFindNewUserConflict(false);
            fetchMembersList();
            return;
        }

        const timeout = setTimeout(() => {
            if (canManage && isValidEmail(email.trim()))
                fetchFindNew(email.trim());
            fetchSearchResults(email.trim());
        }, 300);

        return () => clearTimeout(timeout);
    }, [workspaceId, email, canManage]);

    // Observes the sentinel element and calls loadMore when it enters the viewport.
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
        members,
        setMembers,
        foundUser,
        setFoundUser,
        isMembersLoading,
        isFetchingMore,
        isFindNewUserLoading,
        isFindNewUserConflict,
        sentinelRef,
        currentUserRole,
        canManage,
    };
};

export default useMembersTab;
