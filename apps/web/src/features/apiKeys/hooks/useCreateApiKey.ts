import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { apiKeyKeys } from "@/features/apiKeys/queryKeys";
import type { CreateApiKeyResponseDto } from "@converge/shared";

/**
 * Creates an API key via POST /api-keys. On success it refreshes the key list
 * and calls onSuccess with the full response, including the raw key, which is
 * returned only once, so the caller must show it to the user immediately. A
 * failure shows the global error toast.
 * @param onSuccess - called with the created key after a successful create
 */
const useCreateApiKey = ({
    onSuccess,
}: {
    onSuccess: (created: CreateApiKeyResponseDto) => void;
}) => {
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async (label: string) => {
            const { data } = await apiClient.post<CreateApiKeyResponseDto>(
                "/api-keys",
                { label },
            );
            return data;
        },
        meta: { errorMessage: "Couldn't create the key" },
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() });
            onSuccess(created);
        },
    });

    return {
        createApiKey: (label: string) => mutate(label), // sends the create request
        isCreating: isPending, // true while the create request is in flight
    };
};

export default useCreateApiKey;
