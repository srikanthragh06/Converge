import { useState } from "react";
import { RxAvatar } from "react-icons/rx";
import { type DocumentAccessLevel } from "@converge/shared";
import apiClient from "../lib/http";

/**
 * Card displaying a single user's document access entry. Shows a circular
 * avatar on the left, name and email stacked in the centre, and a select
 * on the right to change the user's access level. Selecting "None" deletes
 * the access row entirely.
 */
const DocumentAccessUserCard = ({
    avatarUrl,
    name,
    email,
    userId,
    documentId,
    access,
    onAccessRemoved,
    onAccessChanged,
    canDeleteAccess = false,
}: {
    /** URL of the user's profile picture, or null to show the generic icon. */
    avatarUrl: string | null;
    /** Display name of the user. */
    name: string;
    /** Email address of the user. */
    email: string;
    /** ID of the user. */
    userId: number;
    /** ID of the document. */
    documentId: string | undefined;
    /** Access level granted to this user; undefined when no access row exists yet. */
    access?: DocumentAccessLevel;
    /** Called after the access row is deleted so the parent can refresh its list. */
    onAccessRemoved?: () => void;
    /** Called after the access level is successfully updated, passing the new level. */
    onAccessChanged?: (newAccess: DocumentAccessLevel) => void;
    /** Whether the "None" option (which deletes the access row) is shown. Defaults to false. */
    canDeleteAccess?: boolean;
}) => {
    const [selectedAccess, setSelectedAccess] = useState<
        DocumentAccessLevel | "__remove__" | ""
    >(access ?? ""); // currently displayed access value; empty string shows the placeholder when no access is set
    const [isLoading, setIsLoading] = useState(false); // true while the PUT or DELETE request is in flight

    /**
     * Handles select changes. Calls PUT to update the access level or DELETE
     * to remove the row when "None" is selected. Disables the select for the
     * duration of the request to prevent double-submission.
     */
    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value;
        if (!documentId) return;

        setIsLoading(true);
        try {
            if (canDeleteAccess && newValue === "__remove__") {
                // Delete the access row entirely.
                await apiClient.delete(
                    `/document/${documentId}/access/${userId}`,
                );
                onAccessRemoved?.();
            } else if (newValue && newValue !== "__remove__") {
                // Update the access level in place.
                await apiClient.put(
                    `/document/${documentId}/access/${userId}`,
                    { access: newValue },
                );
                setSelectedAccess(newValue as DocumentAccessLevel);
                onAccessChanged?.(newValue as DocumentAccessLevel);
            }
        } catch (err) {
            console.error(
                "DocumentAccessUserCard: failed to update access:",
                err,
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-3 py-2">
            {avatarUrl ? (
                <img
                    referrerPolicy="no-referrer"
                    src={avatarUrl}
                    alt={name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                />
            ) : (
                <RxAvatar className="w-8 h-8 text-text-secondary shrink-0" />
            )}
            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm text-text-primary truncate">
                    {name}
                </span>
                <span className="text-xs text-text-secondary truncate">
                    {email}
                </span>
            </div>
            <select
                value={selectedAccess}
                onChange={handleChange}
                disabled={isLoading || !documentId}
                className="text-sm text-white bg-background-base 
                    border-none outline-none focus:outline-none cursor-pointer
                    [&>option]:border-none [&>option]:outline-none [&>option]:bg-background-base
                    disabled:opacity-50 disabled:cursor-not-allowed shrink-0
                    px-2 py-1"
            >
                <option value="" disabled>
                    Select access
                </option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="noAccess">No Access</option>
                {canDeleteAccess && <option value="__remove__">None</option>}
            </select>
        </div>
    );
};

export default DocumentAccessUserCard;
