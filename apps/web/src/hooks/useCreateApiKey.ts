import { useCallback, useState } from "react";
import apiClient from "../lib/http";
import type { CreateApiKeyResponseDto } from "@converge/shared";

/**
 * Returns a createApiKey function that POSTs /api-keys with the given
 * label and resolves to the full response, including the raw key — the
 * only time it is ever returned, so the caller must show it to the user
 * immediately rather than persisting it anywhere.
 */
const useCreateApiKey = () => {
    const [isCreating, setIsCreating] = useState(false); // True while the create request is in flight.
    const [error, setError] = useState<string | null>(null); // Last create error message, if any.

    const createApiKey = useCallback(async (label: string) => {
        setIsCreating(true);
        setError(null);
        try {
            const { data } =
                await apiClient.post<CreateApiKeyResponseDto>("/api-keys", {
                    label,
                });
            return data;
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to create API key";
            setError(message);
            return null;
        } finally {
            setIsCreating(false);
        }
    }, []);

    return { createApiKey, isCreating, error };
};

export default useCreateApiKey;
