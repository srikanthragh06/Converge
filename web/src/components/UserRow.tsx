// UserRow: a single row in the ShareModal members list or search results.
// Shows avatar initial or image, display name, and an access level selector.
// The selector is editable only when canModify is true and the target is not the owner
// or the current user.

import { AccessLevel } from "../types/api";

export default function UserRow({
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
    // Maps an access level to a human-readable label shown in the dropdown.
    const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
        owner: "Owner",
        admin: "Admin",
        editor: "Editor",
        viewer: "Viewer",
    };
    // Access level options available when granting or changing access.
    const GRANTABLE_LEVELS: AccessLevel[] = ["admin", "editor", "viewer"];

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
