// useShareModal: encapsulates all state, refs, callbacks, and effects for ShareModal.
// Takes documentId, isOpen, and onClose as inputs; returns everything needed for rendering.

import { useEffect, useRef, useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "../atoms/uiAtoms";
import { axiosClient } from "../lib/axiosClient";
import {
    ApiResponse,
    AccessLevel,
    DocumentMember,
    UserSearchResult,
    DocumentMembersData,
    DocumentUserSearchData,
} from "../types/api";

function useShareModal(
    documentId: number,
    isOpen: boolean,
    onClose: () => void,
) {
    // Delay (ms) before firing the search after the user stops typing.
    const SEARCH_DEBOUNCE_MS = 300;
    // Number of members to load per page in the members list.
    const MEMBERS_PAGE_SIZE = 10;

    // Needed to identify the current user's own row and determine canModify.
    const currentUser = useAtomValue(currentUserAtom);

    // Whether the current user can modify access (owner or admin).
    // Derived by checking their own entry in the loaded members list.
    const [canModifyAccess, setCanModifyAccess] = useState(false);

    // Search bar query.
    const [searchQuery, setSearchQuery] = useState("");

    // Members loaded for the empty-search view.
    const [members, setMembers] = useState<DocumentMember[]>([]);
    // Cursor for the next page of members; null means no more pages.
    const [membersNextCursor, setMembersNextCursor] = useState<number | null>(
        null,
    );
    // True while the first page of members is loading.
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    // True while a subsequent page of members is loading.
    const [isLoadingMoreMembers, setIsLoadingMoreMembers] = useState(false);

    // User search results for the typed-query view.
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);

    // Sentinel ref for IntersectionObserver pagination on the members list.
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    // Ref for the search input — used to auto-focus when the modal opens.
    const inputRef = useRef<HTMLInputElement | null>(null);
    // Holds the active debounce timer so it can be cancelled on rapid keystrokes.
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    // Load the first page of members — called on open and after access mutations.
    const loadMembers = useCallback(async () => {
        setIsLoadingMembers(true);
        try {
            const res = await axiosClient.get<ApiResponse<DocumentMembersData>>(
                `/documents/${documentId}/access/members?limit=${MEMBERS_PAGE_SIZE}`,
            );
            if (res.data.success) {
                setMembers(res.data.data.members);
                setMembersNextCursor(res.data.data.nextCursor);
                // Determine if the current user can modify access by finding their row.
                const myEntry = res.data.data.members.find(
                    (m) => m.userId === currentUser?.id,
                );
                setCanModifyAccess(
                    myEntry?.accessLevel === "owner" ||
                        myEntry?.accessLevel === "admin",
                );
            }
        } catch (err) {
            console.error("Failed to load members:", err);
        } finally {
            setIsLoadingMembers(false);
        }
    }, [documentId, currentUser?.id]);

    // Load next page of members via the cursor.
    const loadMoreMembers = useCallback(async () => {
        if (membersNextCursor === null || isLoadingMoreMembers) return;
        setIsLoadingMoreMembers(true);
        try {
            const res = await axiosClient.get<ApiResponse<DocumentMembersData>>(
                `/documents/${documentId}/access/members?limit=${MEMBERS_PAGE_SIZE}&cursor=${membersNextCursor}`,
            );
            const body = res.data;
            if (body.success) {
                setMembers((prev) => [...prev, ...body.data.members]);
                setMembersNextCursor(body.data.nextCursor);
            }
        } catch (err) {
            console.error("Failed to load more members:", err);
        } finally {
            setIsLoadingMoreMembers(false);
        }
    }, [documentId, membersNextCursor, isLoadingMoreMembers]);

    // Search users by name/email for the typed-query view.
    const searchUsers = useCallback(
        async (q: string) => {
            if (!q.trim()) {
                setSearchResults([]);
                return;
            }
            setIsLoadingSearch(true);
            try {
                const res = await axiosClient.get<
                    ApiResponse<DocumentUserSearchData>
                >(
                    `/documents/${documentId}/access/users?q=${encodeURIComponent(q)}`,
                );
                if (res.data.success) setSearchResults(res.data.data.users);
            } catch (err) {
                console.error("User search failed:", err);
            } finally {
                setIsLoadingSearch(false);
            }
        },
        [documentId],
    );

    // Update a user's access level or grant access for the first time.
    const handleAccessChange = async (
        userId: number,
        accessLevel: AccessLevel,
    ) => {
        try {
            await axiosClient.put(`/documents/${documentId}/access`, {
                userId,
                accessLevel,
            });
            // Refresh both views after mutation.
            await loadMembers();
            if (searchQuery.trim()) searchUsers(searchQuery);
        } catch (err) {
            console.error("Failed to update access:", err);
        }
    };

    // Remove a user's access entirely.
    const handleRemoveAccess = async (userId: number) => {
        try {
            await axiosClient.delete(
                `/documents/${documentId}/access/${userId}`,
            );
            await loadMembers();
            if (searchQuery.trim()) searchUsers(searchQuery);
        } catch (err) {
            console.error("Failed to remove access:", err);
        }
    };

    // Load members and auto-focus input when the modal opens.
    useEffect(() => {
        if (!isOpen) return;
        setSearchQuery("");
        setSearchResults([]);
        loadMembers();
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [isOpen]);

    // Debounce search as the user types.
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        searchDebounceRef.current = setTimeout(
            () => searchUsers(searchQuery),
            SEARCH_DEBOUNCE_MS,
        );
        return () => {
            if (searchDebounceRef.current)
                clearTimeout(searchDebounceRef.current);
        };
    }, [searchQuery]);

    // IntersectionObserver on sentinel div — triggers loadMoreMembers when visible.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || membersNextCursor === null || searchQuery.trim())
            return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMoreMembers();
            },
            { threshold: 0.1 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [membersNextCursor, isLoadingMoreMembers, searchQuery]);

    // Close on Escape key.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return {
        currentUser,
        canModifyAccess,
        searchQuery,
        setSearchQuery,
        members,
        isLoadingMembers,
        isLoadingMoreMembers,
        searchResults,
        isLoadingSearch,
        sentinelRef,
        inputRef,
        handleAccessChange,
        handleRemoveAccess,
    };
}

export default useShareModal;
