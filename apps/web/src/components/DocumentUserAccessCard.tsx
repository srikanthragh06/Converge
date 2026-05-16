import { useState } from "react";
import { RxAvatar } from "react-icons/rx";
import {
    type DocumentAccessLevel,
    type ResolvedDocumentAccessLevel,
} from "@converge/shared";
import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import apiClient from "../lib/http";
import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import { hasAccess } from "../utils/utils";

/** Display labels for each document access level. */
const ACCESS_LABELS: Record<DocumentAccessLevel, string> = {
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
    noAccess: "No Access",
};

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
 * Card for a single per-user document access entry. Shows avatar, name, email,
 * and fallback access (the level the user reverts to if their explicit row is
 * removed) as a dim subtitle. A dropdown on the right lets admins+ change or
 * remove the access level.
 *
 * Permission rules:
 * - Callers cannot modify their own entry.
 * - Only owners may assign or touch the admin level.
 * - Admins may change editor/viewer/noAccess entries only.
 */
const DocumentUserAccessCard = ({
    avatarUrl,
    name,
    email,
    userId,
    documentId,
    access,
    fallbackAccess,
    documentAccess,
    canDeleteAccess = false,
    onAccessChanged,
    onAccessRemoved,
}: {
    /** URL of the user's profile picture, or null to show the generic icon. */
    avatarUrl: string | null;
    /** Display name of the user. */
    name: string;
    /** Email address of the user. */
    email: string;
    /** Numeric ID of the user. */
    userId: number;
    /** ID of the document this entry belongs to. */
    documentId: string | undefined;
    /** Current explicit access level; undefined when the user has no row yet (add flow). */
    access?: DocumentAccessLevel;
    /** Access level this user would revert to if their explicit row were removed. */
    fallbackAccess: DocumentAccessLevel;
    /** Resolved access level of the calling user, used to gate interactions. */
    documentAccess: ResolvedDocumentAccessLevel;
    /** Whether the "None" option (which deletes the row) is available. Defaults to false. */
    canDeleteAccess?: boolean;
    /** Called with the new access level after a successful PUT. */
    onAccessChanged?: (newAccess: DocumentAccessLevel) => void;
    /** Called after a successful DELETE so the parent can remove the card from its list. */
    onAccessRemoved?: () => void;
}) => {
    const [selectedAccess, setSelectedAccess] = useState<
        DocumentAccessLevel | "__remove__" | null
    >(access ?? null); // currently displayed dropdown value; null shows the placeholder for new users
    const [isLoading, setIsLoading] = useState(false); // true while a PUT or DELETE request is in flight

    const currentUserId = useAtomValue(authAtom).user?.id; // ID of the authenticated user

    // Callers cannot edit their own entry.
    const isSelf = Number(currentUserId) === userId;
    // Owners can interact with anyone. Admins can interact only with editor/viewer/noAccess entries.
    const canInteract =
        !isSelf &&
        (documentAccess === "owner" ||
            (hasAccess(documentAccess, "admin") && access !== "admin"));

    // Owners see all four levels; admins see editor and below only.
    const editableOptions =
        documentAccess === "owner"
            ? BASE_OPTIONS
            : BASE_OPTIONS.filter((o) => o.value !== "admin");

    // Append removal option only when the parent explicitly allows it and the caller can interact.
    const options =
        canDeleteAccess && canInteract
            ? [...editableOptions, REMOVE_OPTION]
            : editableOptions;

    /**
     * Handles dropdown changes. Calls PUT to update the access level or DELETE
     * when "None" is selected. Disables the dropdown for the duration of the
     * request to prevent double-submission.
     */
    const handleChange = async (
        newValue: DocumentAccessLevel | "__remove__",
    ) => {
        if (!documentId || !canInteract) return;

        setIsLoading(true);
        try {
            if (canDeleteAccess && newValue === "__remove__") {
                await apiClient.delete(
                    `/document-access/${documentId}/user/${userId}`,
                );
                onAccessRemoved?.();
            } else if (newValue && newValue !== "__remove__") {
                await apiClient.put(
                    `/document-access/${documentId}/user/${userId}`,
                    { access: newValue },
                );
                setSelectedAccess(newValue as DocumentAccessLevel);
                onAccessChanged?.(newValue as DocumentAccessLevel);
            }
        } catch (err) {
            console.error(
                "DocumentUserAccessCard: failed to update access:",
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
                <span className="text-xs text-text-secondary opacity-40 truncate">
                    Falls back to: {ACCESS_LABELS[fallbackAccess]}
                </span>
            </div>
            <Dropdown
                value={selectedAccess}
                options={options}
                onChange={(e) => handleChange(e.value)}
                placeholder="Select access"
                disabled={!canInteract || isLoading || !documentId}
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
                    trigger: {
                        className: !canInteract ? "hidden" : "text-white",
                    },
                    panel: {
                        className: "bg-background-base border border-gray-700",
                    },
                    item: {
                        className:
                            "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
                    },
                }}
            />
        </div>
    );
};

export default DocumentUserAccessCard;
