import { useCallback, useEffect, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import apiClient from "../lib/http";
import { currentWorkspaceAtom, refreshSidebarAtom } from "../atoms/sidebar";
import useToast from "./useToast";
import type {
    WorkspaceOverviewResponseDto,
    WorkspaceRole,
} from "@converge/shared";

/**
 * Workspace settings data shared by every tab: the workspace overview (name,
 * type, counts, owner, created date) and the caller's role, both fetched on
 * mount. Also owns the General tab's rename and leave actions.
 * @param workspaceId - the workspace being configured
 * @param onLeave - called after a successful leave, so the parent can close and refetch
 */
const useWorkspaceOverview = (workspaceId: number, onLeave?: () => void) => {
    const { showToast } = useToast();
    const [currentWorkspace, setCurrentWorkspace] =
        useAtom(currentWorkspaceAtom); // selected workspace — leaving it is blocked, and a rename of it updates the sidebar header
    const setRefreshSidebar = useSetAtom(refreshSidebarAtom); // re-fetches the sidebar's workspace list after a rename
    const [overview, setOverview] =
        useState<WorkspaceOverviewResponseDto | null>(null); // fetched workspace overview; null until loaded
    const [role, setRole] = useState<WorkspaceRole | null>(null); // caller's role; null until loaded
    const [name, setName] = useState(""); // editable workspace name, seeded from the overview
    const [isSaving, setIsSaving] = useState(false); // true while the rename PATCH is in flight
    const [isLeaving, setIsLeaving] = useState(false); // true while the leave POST is in flight
    const [isConfirmOpen, setIsConfirmOpen] = useState(false); // true while the leave confirmation is shown

    /**
     * Fetches the overview and the caller's role. Re-run after members are
     * added or removed (the count changes) and after an ownership transfer
     * (the caller's role changes).
     */
    const refetch = useCallback(async () => {
        const [overviewResult, roleResult] = await Promise.allSettled([
            apiClient.get<WorkspaceOverviewResponseDto>(
                `/workspaces/${workspaceId}/overview`,
            ),
            apiClient.get<{ role: WorkspaceRole }>(
                `/workspaces/${workspaceId}/my-role`,
            ),
        ]);
        if (overviewResult.status === "fulfilled")
            setOverview(overviewResult.value.data);
        else
            console.error(
                "useWorkspaceOverview: failed to fetch overview",
                overviewResult.reason,
            );
        if (roleResult.status === "fulfilled")
            setRole(roleResult.value.data.role);
        else
            console.error(
                "useWorkspaceOverview: failed to fetch role",
                roleResult.reason,
            );
    }, [workspaceId]);

    // Fetches the overview and the caller's role on mount.
    useEffect(() => {
        refetch();
    }, [refetch]);

    // Seeds the name field once the overview first loads.
    const [seededFor, setSeededFor] = useState<string | null>(null); // overview name the field was last seeded from
    if (overview && overview.name !== seededFor) {
        setSeededFor(overview.name);
        setName(overview.name);
    }

    const trimmedName = name.trim();
    const isNameChanged =
        overview !== null &&
        trimmedName !== "" &&
        trimmedName !== overview.name; // Save shows only after the name changes

    /**
     * Renames the workspace via PATCH /workspaces/:id (admin+), then updates
     * the sidebar: its header if this is the selected workspace, and its
     * workspace list. Failures are reported with a toast.
     */
    const save = async () => {
        if (!isNameChanged || isSaving) return;
        setIsSaving(true);
        try {
            await apiClient.patch(`/workspaces/${workspaceId}`, {
                name: trimmedName,
            });
            setOverview((prev) => prev && { ...prev, name: trimmedName });
            if (currentWorkspace?.id === workspaceId)
                setCurrentWorkspace({ id: workspaceId, name: trimmedName });
            setRefreshSidebar((prev) => prev + 1);
            showToast("Workspace renamed");
        } catch (err) {
            console.error("useWorkspaceOverview: failed to rename", err);
            showToast("Couldn't rename the workspace", { tone: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Leaves the workspace via POST /workspaces/:id/leave-workspace, then
     * calls onLeave. Failures are reported with a toast.
     */
    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await apiClient.post(`/workspaces/${workspaceId}/leave-workspace`);
            setRefreshSidebar((prev) => prev + 1);
            showToast(`Left "${overview?.name ?? "the workspace"}"`);
            onLeave?.();
        } catch (err) {
            console.error("useWorkspaceOverview: failed to leave", err);
            showToast("Couldn't leave the workspace", { tone: "error" });
        } finally {
            setIsLeaving(false);
        }
    };

    const isOwner = role === "owner";
    const isSelected = currentWorkspace?.id === workspaceId; // the server refuses to leave the selected workspace
    const canLeave = role !== null && !isOwner && !isSelected;

    return {
        overview,
        role,
        refetch,
        name,
        setName,
        isNameChanged,
        isSaving,
        save,
        isOwner,
        isSelected,
        canLeave,
        isConfirmOpen,
        setIsConfirmOpen,
        isLeaving,
        handleLeave,
    };
};

export default useWorkspaceOverview;
