import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../lib/http";
import type { WorkspaceOverviewResponseDto } from "@converge/shared";

/**
 * Fetches workspace overview data from GET /workspaces/:id/overview on mount
 * and whenever workspaceId changes. Also exposes a save function to update
 * the workspace name via PATCH /workspaces/:id.
 */
const useWorkspaceOverview = (workspaceId: number) => {
    const [overview, setOverview] = // fetched workspace overview data
        useState<WorkspaceOverviewResponseDto | null>(null);
    const [isLoading, setIsLoading] = useState(true); // true while fetch is in flight
    const [saveStatus, setSaveStatus] = // "saving" → "saved" (1s) → "idle"
        useState<"idle" | "saving" | "saved">("idle");
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout handle to reset saveStatus after 1s

    // Fetch workspace overview on mount and on workspaceId change.
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

    /**
     * Persists the workspace name via PATCH /workspaces/:id.
     * Shows "Saved!" for 1s on success before reverting to idle.
     */
    const save = useCallback(
        async (name: string) => {
            // Ignore clicks while a save is already in flight or the confirmation
            // is still showing.
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
        [workspaceId],
    );

    return { overview, isLoading, saveStatus, save };
};

export default useWorkspaceOverview;
