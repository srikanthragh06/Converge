import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { checkpointKeys } from "../queries/checkpoints";
import type { CreateCheckpointResponseDto } from "@converge/shared";

/** How long the success/error status stays before automatically reverting to idle. */
const TRANSIENT_STATUS_DISPLAY_MS = 2000;

/**
 * Takes a manual version-history checkpoint via POST
 * /document/:id/checkpoint. When one was created, the checkpoint list
 * re-fetches. `status` drives the button's loading/success/error icon; a
 * success or error reverts to idle after TRANSIENT_STATUS_DISPLAY_MS, so the
 * button becomes clickable again. A failure shows the global error toast.
 * @param documentId - the document to checkpoint
 */
const useCreateCheckpoint = (documentId: string | undefined) => {
    const queryClient = useQueryClient();

    const { mutate, status, reset } = useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post<CreateCheckpointResponseDto>(
                `/document/${documentId}/checkpoint`,
            );
            return data;
        },
        meta: { errorMessage: "Couldn't save a checkpoint" },
        onSuccess: (data) => {
            if (data.created)
                queryClient.invalidateQueries({
                    queryKey: checkpointKeys.list(Number(documentId)),
                });
        },
    });

    // Reverts a success/error status to idle after a moment.
    useEffect(() => {
        if (status !== "success" && status !== "error") return;
        const timeoutId = setTimeout(reset, TRANSIENT_STATUS_DISPLAY_MS);
        return () => clearTimeout(timeoutId);
    }, [status, reset]);

    return {
        /**
         * Sends the request, unless one is in flight or a result is showing.
         * @param onSaved - called with the server's response (created is
         *                  false when nothing changed since the last
         *                  checkpoint), e.g. to report it with a toast
         */
        createCheckpoint: (
            onSaved?: (result: CreateCheckpointResponseDto) => void,
        ) => {
            if (status === "idle" && documentId)
                mutate(undefined, { onSuccess: onSaved });
        },
        status: status === "pending" ? ("loading" as const) : status, // idle, loading, success or error
    };
};

export default useCreateCheckpoint;
