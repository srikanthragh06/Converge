import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import apiClient from "../lib/http";
import { currentWorkspaceAtom } from "../atoms/sidebar";
import type {
    WorkspaceOverviewResponseDto,
    WorkspaceRole,
} from "@converge/shared";

/**
 * Fetches workspace overview and the caller's role on mount. Also exposes
 * leave-workspace logic so GeneralTab doesn't need separate state or props.
 */
const useWorkspaceOverview = (workspaceId: number, onLeave?: () => void) => {
    const [overview, setOverview] = // fetched workspace overview data
        useState<WorkspaceOverviewResponseDto | null>(null);
    const [isLoading, setIsLoading] = useState(true); // true while overview fetch is in flight

    const [saveStatus, setSaveStatus] = // "saving" → "saved" (1 s) → "idle"
        useState<"idle" | "saving" | "saved">("idle");
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout handle to reset saveStatus after 1 s

    const [role, setRole] = useState<WorkspaceRole | null>(null); // caller's role; null until loaded
    const [isRoleLoading, setIsRoleLoading] = useState(true); // true while role fetch is in flight
    const [isLeaving, setIsLeaving] = useState(false); // true while the leave-workspace POST is in flight
    const [name, setName] = useState(""); // editable workspace name, seeded from overview
    const [isConfirmOpen, setIsConfirmOpen] = useState(false); // true when the leave confirmation modal is shown

    /**
     * Persists the workspace name via PATCH /workspaces/:id.
     *
     * @param name - The new workspace name.
     * @returns Promise that resolves when the save completes (idempotent — no-ops
     *          while saving or showing "Saved!").
     */
    const save = useCallback(
        async (name: string) => {
            if (saveStatus === "saved" || saveStatus === "saving") return;
            setSaveStatus("saving");
            try {
                await apiClient.patch(`/workspaces/${workspaceId}`, { name });
                setSaveStatus("saved");
                savedTimerRef.current = setTimeout(
                    () => setSaveStatus("idle"),
                    1000,
                );
            } catch (err) {
                console.error("Failed to update workspace", err);
                setSaveStatus("idle");
            }
        },
        [workspaceId, saveStatus],
    );

    /**
     * Leaves the workspace via POST /workspaces/:id/leave-workspace.
     * On success calls the optional onLeave callback so the parent can
     * close the modal and refetch the workspace list.
     *
     * @returns Promise that resolves when the request finishes (success or error).
     */
    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await apiClient.post(`/workspaces/${workspaceId}/leave-workspace`);
            onLeave?.();
        } catch (err) {
            console.error(
                "useWorkspaceOverview: failed to leave workspace:",
                err,
            );
        } finally {
            setIsLeaving(false);
        }
    };

    // Sync name from overview once it loads.
    useEffect(() => {
        if (overview) setName(overview.name);
    }, [overview]);

    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // currently selected workspace in the sidebar

    const isInitialLoading = isRoleLoading || role === null; // true until role is resolved

    // Fetch the caller's role on mount — mirrors the useMembersTab pattern.
    useEffect(() => {
        const fetchRole = async () => {
            try {
                const { data } = await apiClient.get<{ role: WorkspaceRole }>(
                    `/workspaces/${workspaceId}/my-role`,
                );
                setRole(data.role);
            } catch (err) {
                console.error(
                    "useWorkspaceOverview: failed to fetch role:",
                    err,
                );
            } finally {
                setIsRoleLoading(false);
            }
        };
        fetchRole();
    }, [workspaceId]);

    // Fetch workspace overview on mount.
    useEffect(() => {
        const fetchOverview = async () => {
            setIsLoading(true);
            try {
                const { data } =
                    await apiClient.get<WorkspaceOverviewResponseDto>(
                        `/workspaces/${workspaceId}/overview`,
                    );
                setOverview(data);
            } catch (err) {
                console.error("Failed to fetch workspace overview", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOverview();
    }, [workspaceId]);

    // Clean up the saved timer on unmount.
    useEffect(() => {
        return () => {
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        };
    }, []);

    const canLeave =
        role !== null &&
        role !== "owner" &&
        currentWorkspace?.id !== workspaceId;

    return {
        overview,
        isLoading,
        saveStatus,
        save,
        name,
        setName,
        isConfirmOpen,
        setIsConfirmOpen,
        isInitialLoading,
        canLeave,
        handleLeave,
        isLeaving,
    };
};

export default useWorkspaceOverview;
