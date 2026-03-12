// ShareModal: per-document access management overlay.
// Owner and admin can search users, grant/change/remove access.
// Viewers and editors can see who has access but cannot modify it.
// Opens from the Share button in Navbar. Closes on Escape or backdrop click.

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

// Maps an access level to a human-readable label shown in the dropdown.
const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
    owner: "Owner",
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
};

// Access level options available when granting or changing access.
const GRANTABLE_LEVELS: AccessLevel[] = ["admin", "editor", "viewer"];

// Delay (ms) before firing the search after the user stops typing.
const SEARCH_DEBOUNCE_MS = 300;

// Number of members to load per page in the members list.
const MEMBERS_PAGE_SIZE = 10;

export default function ShareModal({
    documentId,
    isOpen,
    onClose,
}: {
    documentId: number;
    isOpen: boolean;
    onClose: () => void;
}) {
    const currentUser = useAtomValue(currentUserAtom);

    // Whether the current user can modify access (owner or admin).
    // Derived by checking their own entry in the loaded members list.
    const [canModify, setCanModify] = useState(false);

    // Search bar query
    const [searchQuery, setSearchQuery] = useState("");

    // Members loaded for the empty-search view
    const [members, setMembers] = useState<DocumentMember[]>([]);
    const [membersNextCursor, setMembersNextCursor] = useState<number | null>(null);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [isLoadingMoreMembers, setIsLoadingMoreMembers] = useState(false);

    // User search results for the typed-query view
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);

    // Sentinel ref for IntersectionObserver pagination on the members list
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                const myEntry = res.data.data.members.find((m) => m.userId === currentUser?.id);
                setCanModify(myEntry?.accessLevel === "owner" || myEntry?.accessLevel === "admin");
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
            if (res.data.success) {
                setMembers((prev) => [...prev, ...res.data.data.members]);
                setMembersNextCursor(res.data.data.nextCursor);
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
                const res = await axiosClient.get<ApiResponse<DocumentUserSearchData>>(
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
    const handleAccessChange = async (userId: number, accessLevel: AccessLevel) => {
        try {
            await axiosClient.put(`/documents/${documentId}/access`, { userId, accessLevel });
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
            await axiosClient.delete(`/documents/${documentId}/access/${userId}`);
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
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchQuery]);

    // IntersectionObserver on sentinel div — triggers loadMoreMembers when visible.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || membersNextCursor === null || searchQuery.trim()) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0]?.isIntersecting) loadMoreMembers(); },
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

    if (!isOpen) return null;

    // Which list to show: search results when query is non-empty, members otherwise.
    const showSearchResults = searchQuery.trim().length > 0;

    return (
        // Backdrop — click outside the panel to close.
        <div
            className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-6"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-80 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[70vh]">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
                    <p className="text-sm font-semibold text-zinc-200">Share</p>
                </div>

                {/* Search bar */}
                <div className="px-3 pt-3 pb-2 shrink-0">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={canModify ? "Search people to invite..." : "Search members..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#2a2a2a] border border-white/10 rounded-md text-zinc-300 placeholder-zinc-600 text-sm outline-none focus:border-zinc-600 transition-colors"
                    />
                </div>

                {/* Results area */}
                <div className="overflow-y-auto flex-1 px-3 pb-3">
                    {showSearchResults ? (
                        // User search results
                        isLoadingSearch ? (
                            <div className="flex flex-col gap-1 pt-1">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="h-10 bg-[#252525] rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : searchResults.length === 0 ? (
                            <p className="text-xs text-zinc-600 text-center py-4">No users found.</p>
                        ) : (
                            <div className="flex flex-col gap-1 pt-1">
                                {searchResults.map((user) => (
                                    <UserRow
                                        key={user.id}
                                        name={user.displayName ?? user.email}
                                        avatarUrl={user.avatarUrl}
                                        accessLevel={user.accessLevel}
                                        isOwner={user.accessLevel === "owner"}
                                        isCurrentUser={user.id === currentUser?.id}
                                        canModify={canModify}
                                        onAccessChange={(level) => handleAccessChange(user.id, level)}
                                        onRemove={() => handleRemoveAccess(user.id)}
                                    />
                                ))}
                            </div>
                        )
                    ) : (
                        // Members list
                        isLoadingMembers ? (
                            <div className="flex flex-col gap-1 pt-1">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="h-10 bg-[#252525] rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : members.length === 0 ? (
                            <p className="text-xs text-zinc-600 text-center py-4">No members yet.</p>
                        ) : (
                            <div className="flex flex-col gap-1 pt-1">
                                {members.map((member) => (
                                    <UserRow
                                        key={member.userId}
                                        name={member.displayName ?? `User ${member.userId}`}
                                        avatarUrl={member.avatarUrl}
                                        accessLevel={member.accessLevel}
                                        isOwner={member.accessLevel === "owner"}
                                        isCurrentUser={member.userId === currentUser?.id}
                                        canModify={canModify}
                                        onAccessChange={(level) => handleAccessChange(member.userId, level)}
                                        onRemove={() => handleRemoveAccess(member.userId)}
                                    />
                                ))}
                                {/* Sentinel for IntersectionObserver */}
                                <div ref={sentinelRef} className="h-1" />
                                {isLoadingMoreMembers && (
                                    <div className="flex justify-center py-2">
                                        <div className="w-3 h-3 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>

                {/* Copy link button */}
                <div className="px-3 pb-3 pt-2 border-t border-white/10 shrink-0">
                    <button
                        onClick={() => navigator.clipboard.writeText(window.location.href)}
                        className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer text-center"
                    >
                        Copy link
                    </button>
                </div>
            </div>
        </div>
    );
}

// Row for a single user in the members list or search results.
// Shows avatar initial, name, and an access level dropdown (disabled if canModify is false or user is owner).
function UserRow({
    name,
    avatarUrl,
    accessLevel,
    isOwner,
    isCurrentUser,
    canModify,
    onAccessChange,
    onRemove,
}: {
    name: string;
    avatarUrl: string | null;
    accessLevel: AccessLevel | null;
    isOwner: boolean;
    isCurrentUser: boolean;
    canModify: boolean;
    onAccessChange: (level: AccessLevel) => void;
    onRemove: () => void;
}) {
    // The dropdown is editable only if: the caller can modify AND the target isn't the owner
    // AND the target isn't the current user (owners can't change their own role).
    const isEditable = canModify && !isOwner && !isCurrentUser;

    return (
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#252525] transition-colors">
            {/* Avatar — first initial or img */}
            <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-xs text-zinc-300 font-medium">
                        {name.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>

            {/* Name */}
            <span className="flex-1 text-sm text-zinc-300 truncate">{name}</span>

            {/* Access level selector */}
            {isEditable ? (
                <select
                    value={accessLevel ?? ""}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === "remove") onRemove();
                        else onAccessChange(val as AccessLevel);
                    }}
                    className="text-xs text-zinc-400 bg-[#2a2a2a] border border-white/10 rounded px-1.5 py-0.5 outline-none cursor-pointer"
                >
                    {GRANTABLE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                            {ACCESS_LEVEL_LABELS[level]}
                        </option>
                    ))}
                    {accessLevel !== null && (
                        <option value="remove">Remove</option>
                    )}
                    {accessLevel === null && (
                        <option value="" disabled>No access</option>
                    )}
                </select>
            ) : (
                <span className="text-xs text-zinc-600 shrink-0">
                    {accessLevel ? ACCESS_LEVEL_LABELS[accessLevel] : "No access"}
                </span>
            )}
        </div>
    );
}
