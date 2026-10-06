import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { apiKeyKeys } from "@/features/apiKeys/queryKeys";
import type { GetApiKeysResponseDto } from "@converge/shared";

/**
 * Loads the authenticated user's API keys from GET /api-keys, cached under
 * `apiKeyKeys.list()`. Creating or revoking a key refreshes it.
 */
const useApiKeys = () => {
    const { data, isPending } = useQuery({
        queryKey: apiKeyKeys.list(),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetApiKeysResponseDto>("/api-keys");
            return data;
        },
    });

    return {
        apiKeys: data ?? [], // the key list; empty until the first load finishes
        isLoading: isPending, // true until the first load finishes
    };
};

export default useApiKeys;
