// ShareModal: per-document access management overlay.
// Owner and admin can search users, grant/change/remove access.
// Viewers and editors can see who has access but cannot modify it.
// Opens from the Share button in DocumentNavbar. Closes on Escape or backdrop click.

import { AccessLevel } from "../../types/api";
import UserRow from "./UserRow";
import useShareModal from "../../hooks/useShareModal";

export default function ShareModal({
    documentId,
    isOpen,
    onClose,
}: {
    documentId: number;
    isOpen: boolean;
    onClose: () => void;
}) {
    const {
        currentUser,
        canModify,
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
    } = useShareModal(documentId, isOpen, onClose);

    if (!isOpen) return null;

    // Which list to show: search results when query is non-empty, members otherwise.
    const showSearchResults = searchQuery.trim().length > 0;

    return (
        // Backdrop — click outside the panel to close.
        <div
            className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-6"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
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
                        placeholder={
                            canModify
                                ? "Search people to invite..."
                                : "Search members..."
                        }
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
                                    <div
                                        key={i}
                                        className="h-10 bg-[#252525] rounded-lg animate-pulse"
                                    />
                                ))}
                            </div>
                        ) : searchResults.length === 0 ? (
                            <p className="text-xs text-zinc-600 text-center py-4">
                                No users found.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-1 pt-1">
                                {searchResults.map((user) => (
                                    <UserRow
                                        key={user.id}
                                        name={user.displayName ?? user.email}
                                        avatarUrl={user.avatarUrl}
                                        accessLevel={user.accessLevel}
                                        isOwner={user.accessLevel === "owner"}
                                        isCurrentUser={
                                            user.id === currentUser?.id
                                        }
                                        canModify={canModify}
                                        onAccessChange={(level: AccessLevel) =>
                                            handleAccessChange(user.id, level)
                                        }
                                        onRemove={() =>
                                            handleRemoveAccess(user.id)
                                        }
                                    />
                                ))}
                            </div>
                        )
                    ) : // Members list
                    isLoadingMembers ? (
                        <div className="flex flex-col gap-1 pt-1">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-10 bg-[#252525] rounded-lg animate-pulse"
                                />
                            ))}
                        </div>
                    ) : members.length === 0 ? (
                        <p className="text-xs text-zinc-600 text-center py-4">
                            No members yet.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1 pt-1">
                            {members.map((member) => (
                                <UserRow
                                    key={member.userId}
                                    name={
                                        member.displayName ??
                                        `User ${member.userId}`
                                    }
                                    avatarUrl={member.avatarUrl}
                                    accessLevel={member.accessLevel}
                                    isOwner={member.accessLevel === "owner"}
                                    isCurrentUser={
                                        member.userId === currentUser?.id
                                    }
                                    canModify={canModify}
                                    onAccessChange={(level: AccessLevel) =>
                                        handleAccessChange(member.userId, level)
                                    }
                                    onRemove={() =>
                                        handleRemoveAccess(member.userId)
                                    }
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
                    )}
                </div>

                {/* Copy link button */}
                <div className="px-3 pb-3 pt-2 border-t border-white/10 shrink-0">
                    <button
                        onClick={() =>
                            navigator.clipboard.writeText(window.location.href)
                        }
                        className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer text-center"
                    >
                        Copy link
                    </button>
                </div>
            </div>
        </div>
    );
}
