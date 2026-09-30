import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiKeyDto } from "@converge/shared";
import apiClient from "../lib/http";
import { apiKeyKeys } from "../queries/apiKeys";
import useToast from "./useToast";

/**
 * Revokes an API key via DELETE /api-keys/:id. On success it refreshes the
 * key list, shows a toast and calls onSuccess so the caller can close its
 * dialog; a failure shows the global error toast.
 * @param apiKey - the key to revoke
 * @param onSuccess - called after a successful revoke
 */
const useRevokeApiKey = ({
    apiKey,
    onSuccess,
}: {
    apiKey: ApiKeyDto;
    onSuccess: () => void;
}) => {
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: () => apiClient.delete(`/api-keys/${apiKey.id}`),
        meta: { errorMessage: "Couldn't revoke the key" },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() });
            showToast(`Revoked "${apiKey.label}"`);
            onSuccess();
        },
    });

    return {
        isRevoking: isPending, // true while the revoke request is in flight
        handleConfirm: () => mutate(), // sends the revoke request
    };
};

export default useRevokeApiKey;
