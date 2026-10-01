import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
    DocumentAccessLevel,
    FindNewDocumentAccessUserResponseDto,
} from "@converge/shared";
import { isAxiosError } from "axios";
import apiClient from "../lib/http";
import { accessKeys } from "../queries/access";
import { isValidEmail } from "../utils/utils";
import useToast from "./useToast";

/**
 * Result of looking up the typed email: nothing to show yet, in flight, a
 * user who can be added, no account with that email (404), or someone who
 * is already the owner or has direct access (409).
 */
export type EmailLookup =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "found"; user: FindNewDocumentAccessUserResponseDto }
    | { status: "notFound" }
    | { status: "hasAccess" };

/**
 * The Share dialog's "Add people by email" field. Typing a full email looks
 * the person up (debounced) so they can be added with a chosen level.
 * @param documentId - the document being shared
 * @param canManage - whether the caller may add people (admins and above)
 */
const useShareDialog = (documentId: string | undefined, canManage: boolean) => {
    const queryClient = useQueryClient();
    const [email, setEmail] = useState(""); // text in the "Add people by email" field
    const [lookupResult, setLookupResult] = useState<{
        email: string;
        lookup: EmailLookup;
    } | null>(null); // latest settled lookup and the email it was for
    const [isAdding, setIsAdding] = useState(false); // true while the add PUT is in flight
    const { showToast } = useToast(); // reports failed writes

    const trimmedEmail = email.trim(); // the typed email without stray spaces
    const canLookUp = canManage && isValidEmail(trimmedEmail); // a lookup runs only for admins, once the address is complete
    // Derived: idle until the address is complete, loading until the lookup
    // for exactly this address settles.
    const lookup: EmailLookup = !canLookUp
        ? { status: "idle" }
        : lookupResult?.email === trimmedEmail
          ? lookupResult.lookup
          : { status: "loading" };

    // Looks up the typed email 300ms after typing stops, once it's a full
    // address; admins only, since only they can add people. Results are
    // stored with their email, so a stale response never shows for a newer one.
    useEffect(() => {
        if (!documentId || !canLookUp) return;

        const timeout = setTimeout(async () => {
            /** Stores the lookup's outcome for the email it was made for. */
            const settle = (lookup: EmailLookup) =>
                setLookupResult({ email: trimmedEmail, lookup });
            try {
                const { data } =
                    await apiClient.get<FindNewDocumentAccessUserResponseDto>(
                        `/document-access/${documentId}/find-new`,
                        { params: { email: trimmedEmail } },
                    );
                settle({ status: "found", user: data });
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) settle({ status: "notFound" });
                else if (status === 409) settle({ status: "hasAccess" });
                else {
                    console.error("useShareDialog: email lookup failed:", err);
                    settle({ status: "idle" });
                }
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [documentId, trimmedEmail, canLookUp]);

    /**
     * Gives the looked-up person direct access, then refreshes the people
     * list and clears the field.
     * @param access - the level chosen in the add card
     */
    const addPerson = async (access: DocumentAccessLevel) => {
        if (!documentId || lookup.status !== "found") return;
        const user = lookup.user;
        try {
            setIsAdding(true);
            await apiClient.put(
                `/document-access/${documentId}/user/${user.id}`,
                { access },
            );
            queryClient.invalidateQueries({
                queryKey: accessKeys.list(Number(documentId)),
            });
            setEmail("");
            setLookupResult(null); // they have access now, so an old "found" result is stale
        } catch (err) {
            console.error("useShareDialog: failed to add person:", err);
            showToast(`Couldn't add ${user.name}`, { tone: "error" });
        } finally {
            setIsAdding(false);
        }
    };

    return { email, setEmail, lookup, isAdding, addPerson };
};

export default useShareDialog;
