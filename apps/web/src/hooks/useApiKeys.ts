import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type { GetApiKeysResponseDto } from "@converge/shared";

/**
 * Fetches the authenticated user's API keys from GET /api-keys on mount,
 * and exposes fetchAll for callers to manually refresh the list (e.g.
 * after creating a new key).
 */
const useApiKeys = () => {
    const [apiKeys, setApiKeys] = useState<GetApiKeysResponseDto>([]); // Fetched API key list.
    const [isLoading, setIsLoading] = useState(false); // Whether a fetch is in progress.

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const { data } =
                await apiClient.get<GetApiKeysResponseDto>("/api-keys");
            setApiKeys(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Loads the key list once, on mount.
    useEffect(() => {
        fetchAll();
    }, []);

    return { apiKeys, isLoading, fetchAll };
};

export default useApiKeys;
