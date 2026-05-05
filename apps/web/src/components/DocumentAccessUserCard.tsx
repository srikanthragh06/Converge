import { useState } from "react";
import { RxAvatar } from "react-icons/rx";
import { type DocumentAccessLevel } from "@converge/shared";
import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import apiClient from "../lib/http";

/** Option shape for the access level dropdown. */
interface AccessOption {
    label: string;
    value: DocumentAccessLevel | "__remove__";
}

const BASE_OPTIONS: AccessOption[] = [
    { label: "Admin", value: "admin" },
    { label: "Editor", value: "editor" },
    { label: "Viewer", value: "viewer" },
    { label: "No Access", value: "noAccess" },
];

const REMOVE_OPTION: AccessOption = { label: "None", value: "__remove__" };

/**
 * Card displaying a single user's document access entry. Shows a circular
 * avatar on the left, name and email stacked in the centre, and a dropdown
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
    isOwner = false,
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
    /** When true, replaces the dropdown with a fixed disabled "Owner" label. Defaults to false. */
    isOwner?: boolean;
}) => {
    const [selectedAccess, setSelectedAccess] = useState<
        DocumentAccessLevel | "__remove__" | null
    >(access ?? null); // currently displayed access value; null shows the placeholder when no access is set yet
    const [isLoading, setIsLoading] = useState(false); // true while a PUT or DELETE request is in flight

    // Append the "None" removal option only when the parent explicitly allows deletion.
    const options = canDeleteAccess
        ? [...BASE_OPTIONS, REMOVE_OPTION]
        : BASE_OPTIONS;

    /**
     * Handles dropdown changes. Calls PUT to update the access level or DELETE
     * to remove the row when "None" is selected. Disables the dropdown for the
     * duration of the request to prevent double-submission.
     */
    const handleChange = async (
        newValue: DocumentAccessLevel | "__remove__",
    ) => {
        if (!documentId) return;

        setIsLoading(true);
        try {
            if (canDeleteAccess && newValue === "__remove__") {
                await apiClient.delete(
                    `/document/${documentId}/access/${userId}`,
                );
                onAccessRemoved?.();
            } else if (newValue && newValue !== "__remove__") {
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
        <div className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2">
            {avatarUrl ? (
                <img
                    referrerPolicy="no-referrer"
                    src={avatarUrl}
                    alt={name}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                />
            ) : (
                <RxAvatar className="w-7 h-7 sm:w-8 sm:h-8 text-text-secondary shrink-0" />
            )}
            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs sm:text-sm text-text-primary truncate">
                    {name}
                </span>
                <span className="text-xs text-text-secondary truncate">
                    {email}
                </span>
            </div>
            {isOwner ? (
                <span className="shrink-0 text-xs sm:text-sm text-text-secondary opacity-50 px-1.5 sm:px-2 py-0.5 sm:py-1">
                    Owner
                </span>
            ) : (
                <Dropdown
                    value={selectedAccess}
                    options={options}
                    onChange={(e) => handleChange(e.value)}
                    placeholder="Select access"
                    disabled={isLoading || !documentId}
                    className="shrink-0 text-xs sm:text-sm"
                    pt={{
                        root: {
                            className:
                                "border-none bg-transparent focus:outline-none",
                        },
                        input: {
                            className:
                                "text-xs sm:text-sm text-white py-0.5 sm:py-1 px-1.5 sm:px-2",
                        },
                        trigger: { className: "text-white" },
                        panel: {
                            className:
                                "bg-background-base border border-gray-700",
                        },
                        item: {
                            className:
                                "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
                        },
                    }}
                />
            )}
        </div>
    );
};

export default DocumentAccessUserCard;
