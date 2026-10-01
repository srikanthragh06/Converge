import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import { isValidEmail } from "../utils/utils";
import useDebouncedValue from "./useDebouncedValue";
import type { FindNewWorkspaceUserResponseDto } from "@converge/shared";

/**
 * Looks up who the typed email belongs to, so they can be added to the
 * workspace, via GET /workspaces/:id/findNewUser, 300ms after typing stops
 * and only once the address is complete. The result is idle (nothing to look
 * up, or the lookup failed), loading, a user who can be added, no account
 * with that email (404), or someone already in the workspace (409).
 * @param workspaceId - the workspace being configured
 * @param email - the email field's text
 * @param enabled - whether the caller may add members at all
 */
const useNewMemberLookup = (
    workspaceId: number,
    email: string,
    enabled: boolean,
) => {
    const trimmedEmail = email.trim();
    const debouncedEmail = useDebouncedValue(trimmedEmail, 300);
    const canLookUp = enabled && isValidEmail(trimmedEmail);

    const { data, isError } = useQuery({
        queryKey: workspaceKeys.findNewMember(workspaceId, debouncedEmail),
        queryFn: async () => {
            try {
                const { data } =
                    await apiClient.get<FindNewWorkspaceUserResponseDto>(
                        `/workspaces/${workspaceId}/findNewUser`,
                        { params: { email: debouncedEmail } },
                    );
                return { status: "found" as const, user: data };
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) return { status: "notFound" as const };
                if (status === 409) return { status: "isMember" as const };
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

export default useNewMemberLookup;
