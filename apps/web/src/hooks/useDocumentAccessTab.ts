import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    DocumentAccessLevel,
    GetWorkspaceDocAccessDefaultsResponseDto,
    WorkspaceRole,
} from "@converge/shared";

/**
 * Manages DocumentAccessTab state. Fetches the caller's workspace role and
 * the workspace's per-role document access defaults in parallel on mount.
 * Exposes updateDefault for optimistic per-field PATCH updates.
 */
const useDocumentAccessTab = ({ workspaceId }: { workspaceId: number }) => {
    const [role, setRole] = useState<WorkspaceRole | null>(null); // caller's workspace role; null until loaded
    const [isRoleLoading, setIsRoleLoading] = useState(true); // true while the role fetch is in flight

    const [defaults, setDefaults] =
        useState<GetWorkspaceDocAccessDefaultsResponseDto | null>(null); // per-role doc access defaults; null until loaded
    const [isDefaultsLoading, setIsDefaultsLoading] = useState(true); // true while the defaults fetch is in flight

    const [isSaving, setIsSaving] = useState(false); // true while a PATCH is in flight

    // Fetch the caller's role on mount.
    useEffect(() => {
        const fetchRole = async () => {
            try {
                const { data } = await apiClient.get<{ role: WorkspaceRole }>(
                    `/workspaces/${workspaceId}/my-role`,
                );
                setRole(data.role);
            } catch (err) {
                console.error(
                    "useDocumentAccessTab: failed to fetch role:",
                    err,
                );
            } finally {
                setIsRoleLoading(false);
            }
        };
        fetchRole();
    }, [workspaceId]);

    // Fetch the workspace's per-role doc access defaults on mount.
    useEffect(() => {
        const fetchDefaults = async () => {
            try {
                const { data } =
                    await apiClient.get<GetWorkspaceDocAccessDefaultsResponseDto>(
                        `/workspaces/${workspaceId}/doc-access-defaults`,
                    );
                setDefaults(data);
            } catch (err) {
                console.error(
                    "useDocumentAccessTab: failed to fetch defaults:",
                    err,
                );
            } finally {
                setIsDefaultsLoading(false);
            }
        };
        fetchDefaults();
    }, [workspaceId]);

    /**
     * Optimistically updates one per-role default and persists it via PATCH.
     * Reverts the local state if the request fails.
     *
     * @param field - The role field to update.
     * @param value - The new document access level.
     */
    const updateDefault = async (
        field: keyof GetWorkspaceDocAccessDefaultsResponseDto,
        value: DocumentAccessLevel,
    ) => {
        // Bail out if data is not yet loaded or a save is already in flight.
        if (!defaults || isSaving) return;

        // Apply the change optimistically so the UI responds immediately.
        const previous = defaults[field];
        setDefaults({ ...defaults, [field]: value });
        setIsSaving(true);

        try {
            await apiClient.patch(
                `/workspaces/${workspaceId}/doc-access-defaults`,
                { [field]: value },
            );
        } catch (err) {
            // Revert to the pre-update value if the request fails.
            console.error(
                "useDocumentAccessTab: failed to update default:",
                err,
            );
            setDefaults({ ...defaults, [field]: previous });
        } finally {
            setIsSaving(false);
        }
    };

    const isLoading = isRoleLoading || isDefaultsLoading; // true until both the role and defaults fetches have settled

    return { role, defaults, isLoading, isSaving, updateDefault };
};

export default useDocumentAccessTab;
