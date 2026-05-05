import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    DocumentAccessUserDto,
    GetDocumentAccessResponseDto,
    SearchDocumentAccessUsersResponseDto,
} from "@converge/shared";

const ACCESS_LIST_LIMIT = 20;

/**
 * Manages ManageAccessTab state. Fetches the document's access list when the
 * email query is empty, or hits the search endpoint when it is non-empty
 * (debounced 300 ms). Returns the resolved user list.
 */
const useManageAccessTab = ({
    documentId,
    email,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
    /** Current email search query typed by the user. */
    email: string;
}) => {
    const [existingUsers, setExistingUsers] = useState<DocumentAccessUserDto[]>([]); // current list of access users shown in the tab
    const [isLoading, setIsLoading] = useState(false); // true while a fetch is in flight

    /** Fetches the full access list for the document. */
    const fetchAccessList = async (docId: string) => {
        try {
            setIsLoading(true);
            const { data } = await apiClient.get<GetDocumentAccessResponseDto>(
                `/document/${docId}/access`,
                { params: { limit: ACCESS_LIST_LIMIT } },
            );
            setExistingUsers(data.users);
        } catch (err) {
            console.error("ManageAccessTab: failed to fetch access list:", err);
        } finally {
            setIsLoading(false);
        }
    };

    /** Fetches users whose email fuzzy-matches the query. */
    const fetchSearchResults = async (docId: string, query: string) => {
        try {
            setIsLoading(true);
            const { data } =
                await apiClient.get<SearchDocumentAccessUsersResponseDto>(
                    `/document/${docId}/access/search`,
                    { params: { email: query } },
                );
            setExistingUsers(data.users);
        } catch (err) {
            console.error(
                "ManageAccessTab: failed to search access users:",
                err,
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Debounces email and switches between list and search endpoints.
    // When email is empty, fetches the full access list immediately.
    // When email is non-empty, waits 300 ms before firing the search.
    useEffect(() => {
        if (!documentId) return;

        if (email.trim() === "") {
            fetchAccessList(documentId);
            return;
        }

        const timeout = setTimeout(() => {
            fetchSearchResults(documentId, email.trim());
        }, 300);

        return () => clearTimeout(timeout);
    }, [documentId, email]);

    return { existingUsers, isLoading };
};

export default useManageAccessTab;
