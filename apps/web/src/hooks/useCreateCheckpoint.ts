import { useCallback, useEffect, useState } from "react";
import apiClient from "../lib/http";
import type { CreateCheckpointResponseDto } from "@converge/shared";

/** How long the success/error status stays before automatically reverting to idle. */
const TRANSIENT_STATUS_DISPLAY_MS = 2000;

/**
 * Returns a createCheckpoint function that POSTs /document/:id/checkpoint to
 * take a manual version-history checkpoint, and the status of the most
 * recent attempt so the caller can render a loading/success/error icon.
 * No-ops if a request is already in flight, currently showing a
 * success/error result, or documentId is not yet available. A success or
 * error status automatically reverts to idle after
 * TRANSIENT_STATUS_DISPLAY_MS, so the button becomes clickable again without
 * requiring the user to do anything first.
 * @param documentId - the document to checkpoint
 */
const useCreateCheckpoint = (documentId: string | undefined) => {
    const [status, setStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle"); // status of the most recent checkpoint creation attempt

    // Auto-reverts a success/error status back to idle after
    // TRANSIENT_STATUS_DISPLAY_MS. Cleared if status changes again (a new
    // attempt) or the component unmounts before the timeout fires, so it
    // never fires a stale revert.
    useEffect(() => {
        if (status !== "success" && status !== "error") return;
        const timeoutId = setTimeout(
            () => setStatus("idle"),
            TRANSIENT_STATUS_DISPLAY_MS,
        );
        return () => clearTimeout(timeoutId);
    }, [status]);

    /**
     * Sends the checkpoint request and updates status based on the outcome.
     * @returns the server's response (created is false when nothing changed
     *          since the last checkpoint), or null if the request failed or
     *          was skipped — for a caller that reports the result itself, e.g.
     *          with a toast from a menu that closes on tap
     */
    const createCheckpoint =
        useCallback(async (): Promise<CreateCheckpointResponseDto | null> => {
            if (status !== "idle" || !documentId) return null;
            try {
                setStatus("loading");
                const { data } =
                    await apiClient.post<CreateCheckpointResponseDto>(
                        `/document/${documentId}/checkpoint`,
                    );
                setStatus("success");
                return data;
            } catch (err) {
                console.error(
                    "useCreateCheckpoint: failed to create checkpoint",
                    err,
                );
                setStatus("error");
                return null;
            }
        }, [status, documentId]);

    return { createCheckpoint, status };
};

export default useCreateCheckpoint;
