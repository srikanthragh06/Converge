import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import apiClient from "@/lib/http";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import { isValidEmail } from "@/lib/utils";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import type { FindWorkspaceOwnerCandidateResponseDto } from "@converge/shared";

/**
 * Looks up who would take over a workspace for the typed email, via
 * GET /workspaces/:id/owner/find, 300ms after typing stops and only once the
 * address is complete. The result is idle (nothing to look up, or the lookup
 * failed), loading, a user who can take over, no account with that email
 * (404), or the caller's own address (409).
 * @param workspaceId - the workspace being transferred
 * @param email - the new owner's email as typed
 * @param enabled - whether the caller may transfer at all
 */
const useOwnerCandidate = (
    workspaceId: number,
    email: string,
    enabled: boolean,
) => {
    const trimmedEmail = email.trim();
    const debouncedEmail = useDebouncedValue(trimmedEmail, 300);
    const canLookUp = enabled && isValidEmail(trimmedEmail);

    const { data, isError } = useQuery({
        queryKey: workspaceKeys.ownerCandidate(workspaceId, debouncedEmail),
        queryFn: async () => {
            try {
                const { data } =
                    await apiClient.get<FindWorkspaceOwnerCandidateResponseDto>(
                        `/workspaces/${workspaceId}/owner/find`,
                        { params: { email: debouncedEmail } },
                    );
                return { status: "found" as const, user: data };
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) return { status: "notFound" as const };
                if (status === 409) return { status: "isOwner" as const };
                throw err;
            }
        },
        enabled: canLookUp && debouncedEmail === trimmedEmail,
    });

    if (!canLookUp || isError) return { status: "idle" as const };
    // Loading until the debounce settles and the lookup for exactly this address returns.
    if (debouncedEmail !== trimmedEmail || !data)
        return { status: "loading" as const };
    return data;
};

export default useOwnerCandidate;
