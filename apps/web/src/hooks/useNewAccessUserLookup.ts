import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import apiClient from "../lib/http";
import { accessKeys } from "../queries/access";
import { isValidEmail } from "../utils/utils";
import useDebouncedValue from "./useDebouncedValue";
import type { FindNewDocumentAccessUserResponseDto } from "@converge/shared";

/**
 * Looks up who the typed email belongs to, so they can be given access to
 * the document, via GET /document-access/:id/find-new, 300ms after typing
 * stops and only once the address is complete. The result is idle (nothing
 * to look up, or the lookup failed), loading, a user who can be added, no
 * account with that email (404), or someone who is already the owner or has
 * direct access (409).
 * @param documentId - the document being shared
 * @param email - the email field's text
 * @param enabled - whether the caller may add people at all
 */
const useNewAccessUserLookup = (
    documentId: number,
    email: string,
    enabled: boolean,
) => {
    const trimmedEmail = email.trim();
    const debouncedEmail = useDebouncedValue(trimmedEmail, 300);
    const canLookUp = enabled && isValidEmail(trimmedEmail);

    const { data, isError } = useQuery({
        queryKey: accessKeys.findNewUser(documentId, debouncedEmail),
        queryFn: async () => {
            try {
                const { data } =
                    await apiClient.get<FindNewDocumentAccessUserResponseDto>(
                        `/document-access/${documentId}/find-new`,
                        { params: { email: debouncedEmail } },
                    );
                return { status: "found" as const, user: data };
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) return { status: "notFound" as const };
                if (status === 409) return { status: "hasAccess" as const };
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

export default useNewAccessUserLookup;
