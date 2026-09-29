import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import apiClient from "../lib/http";
import useToast from "./useToast";
import { isValidEmail } from "../utils/utils";
import { hasWorkspaceRole } from "@converge/shared";
import type {
    WorkspaceMemberDto,
    FindNewWorkspaceUserResponseDto,
    GetWorkspaceMembersResponseDto,
    SearchWorkspaceMembersResponseDto,
    WorkspaceRole,
} from "@converge/shared";

const MEMBERS_LIST_LIMIT = 20;

/**
 * Result of looking up the typed email: nothing to show yet, in flight, a
 * user who can be added, no account with that email (404), or someone
 * already in the workspace (409).
 */
export type MemberLookup =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "found"; user: FindNewWorkspaceUserResponseDto }
    | { status: "notFound" }
    | { status: "isMember" };

/**
 * State and actions for the workspace settings Members tab. With the email
 * field empty, lists members with infinite scroll (IntersectionObserver on
 * sentinelRef). Typing filters the list (debounced 300 ms search) and, for
 * admins and the owner once the address is complete, looks the person up
 * so they can be added with a chosen role. Adding, changing a role, and
 * removing are reported with a toast on failure.
 * @param workspaceId - the workspace being configured
 * @param role - the caller's role, or null while it loads
 * @param onMembersChanged - called after a member is added or removed, e.g. to refresh the count
 */
const useMembersTab = ({
    workspaceId,
    role,
    onMembersChanged,
}: {
    workspaceId: number;
    role: WorkspaceRole | null;
    onMembersChanged?: () => void;
}) => {
    const { showToast } = useToast();
    const [email, setEmail] = useState(""); // text in the email field; filters the list and drives the lookup
    const [members, setMembers] = useState<WorkspaceMemberDto[]>([]); // accumulated members list; replaced on search, appended on loadMore
    const [lookupResult, setLookupResult] = useState<{
        email: string;
        lookup: MemberLookup;
    } | null>(null); // latest settled lookup and the email it was for
    const [isMembersLoading, setIsMembersLoading] = useState(true); // true while the first page or a search is in flight
    const [isFetchingMore, setIsFetchingMore] = useState(false); // true while a later page is loading
    const [isAdding, setIsAdding] = useState(false); // true while the add request is in flight
    const [pendingUserId, setPendingUserId] = useState<number | null>(null); // member whose role change or removal is in flight

    const canManage = role !== null && hasWorkspaceRole(role, "admin"); // admins and the owner may add and remove members
    const trimmedEmail = email.trim();
    const canLookUp = canManage && isValidEmail(trimmedEmail); // a lookup runs only for managers, once the address is complete
    // Derived: idle until the address is complete, loading until the lookup
    // for exactly this address settles.
    const lookup: MemberLookup = !canLookUp
        ? { status: "idle" }
        : lookupResult?.email === trimmedEmail
          ? lookupResult.lookup
          : { status: "loading" };

    const nextCursorRef = useRef<number | null>(null); // keyset cursor for the next page; null when no more pages exist
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore always reads the latest value without being in deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /** Fetches the first page of the members list and resets pagination state. */
    const fetchMembersList = async () => {
        try {
            setIsMembersLoading(true);
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
     * @param query - the typed email text
     */
    const fetchSearchResults = async (query: string) => {
        try {
            setIsMembersLoading(true);
            const { data } =
                await apiClient.get<SearchWorkspaceMembersResponseDto>(
                    `/workspaces/${workspaceId}/members/search`,
                    { params: { email: query } },
                );
            setMembers(data.members);
            nextCursorRef.current = null;
            hasMoreRef.current = false;
        } catch (err) {
            console.error("useMembersTab: failed to search members:", err);
        } finally {
            setIsMembersLoading(false);
        }
    };

    // Lists every member while the field is empty; otherwise filters the
    // list 300 ms after typing stops. Waits until the role is loaded.
    useEffect(() => {
        if (role === null) return;
        if (trimmedEmail === "") {
            fetchMembersList();
            return;
        }
        const timeout = setTimeout(() => fetchSearchResults(trimmedEmail), 300);
        return () => clearTimeout(timeout);
    }, [workspaceId, trimmedEmail, role]);

    // Looks up the typed email 300 ms after typing stops, once it's a full
    // address; managers only. Results are stored with their email, so a
    // stale response never shows for a newer one.
    useEffect(() => {
        if (!canLookUp) return;

        const timeout = setTimeout(async () => {
            /** Stores the lookup's outcome for the email it was made for. */
            const settle = (lookup: MemberLookup) =>
                setLookupResult({ email: trimmedEmail, lookup });
            try {
                const { data } =
                    await apiClient.get<FindNewWorkspaceUserResponseDto>(
                        `/workspaces/${workspaceId}/findNewUser`,
                        { params: { email: trimmedEmail } },
                    );
                settle({ status: "found", user: data });
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) settle({ status: "notFound" });
                else if (status === 409) settle({ status: "isMember" });
                else {
                    console.error("useMembersTab: email lookup failed:", err);
                    settle({ status: "idle" });
                }
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [workspaceId, trimmedEmail, canLookUp]);

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

    /**
     * Adds the looked-up person with the chosen role via POST
     * /workspaces/:id/members, then clears the field, which reloads the list
     * with them in it.
     * @param newRole - the role chosen in the add card
     */
    const addMember = async (newRole: WorkspaceRole) => {
        if (lookup.status !== "found") return;
        const user = lookup.user;
        try {
            setIsAdding(true);
            await apiClient.post(`/workspaces/${workspaceId}/members`, {
                email: user.email,
                role: newRole,
            });
            setEmail("");
            setLookupResult(null); // they're a member now, so an old "found" result is stale
            onMembersChanged?.();
        } catch (err) {
            console.error("useMembersTab: failed to add member:", err);
            showToast(`Couldn't add ${user.name}`, { tone: "error" });
        } finally {
            setIsAdding(false);
        }
    };

    /**
     * Changes a member's role (owner only) via POST /workspaces/:id/members.
     * @param member - the member whose role changes
     * @param newRole - the new role
     */
    const changeRole = async (
        member: WorkspaceMemberDto,
        newRole: WorkspaceRole,
    ) => {
        if (newRole === member.role) return;
        try {
            setPendingUserId(member.id);
            await apiClient.post(`/workspaces/${workspaceId}/members`, {
                email: member.email,
                role: newRole,
            });
            setMembers((prev) =>
                prev.map((m) =>
                    m.id === member.id ? { ...m, role: newRole } : m,
                ),
            );
        } catch (err) {
            console.error("useMembersTab: failed to change role:", err);
            showToast(`Couldn't change ${member.name}'s role`, {
                tone: "error",
            });
        } finally {
            setPendingUserId(null);
        }
    };

    /**
     * Removes a member via DELETE /workspaces/:id/members/:userId.
     * @param member - the member to remove
     */
    const removeMember = async (member: WorkspaceMemberDto) => {
        try {
            setPendingUserId(member.id);
            await apiClient.delete(
                `/workspaces/${workspaceId}/members/${member.id}`,
            );
            setMembers((prev) => prev.filter((m) => m.id !== member.id));
            onMembersChanged?.();
        } catch (err) {
            console.error("useMembersTab: failed to remove member:", err);
            showToast(`Couldn't remove ${member.name}`, { tone: "error" });
        } finally {
            setPendingUserId(null);
        }
    };

    return {
        email,
        setEmail,
        members,
        lookup,
        isMembersLoading,
        isFetchingMore,
        isAdding,
        pendingUserId,
        sentinelRef,
        canManage,
        addMember,
        changeRole,
        removeMember,
    };
};

export default useMembersTab;
