import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import { isValidEmail } from "../utils/utils";
import type {
    DocumentAccessUserDto,
    FindNewDocumentAccessUserResponseDto,
    GetDocumentAccessResponseDto,
    SearchDocumentAccessUsersResponseDto,
} from "@converge/shared";

const ACCESS_LIST_LIMIT = 20;

/**
 * Manages ManageAccessTab state. When email is empty, fetches the full access
 * list. When email is non-empty (debounced 300 ms), fires both the find-new
 * and search endpoints — find-new resolves a new user to add, search filters
 * the existing access list. Each has its own loading state.
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
    const [existingUsers, setExistingUsers] = useState<DocumentAccessUserDto[]>(
        [],
    ); // current filtered or full access list
    const [foundUser, setFoundUser] =
        useState<FindNewDocumentAccessUserResponseDto | null>(null); // user resolved by exact email who has no access yet
    const [isExistingUsersLoading, setIsExistingUsersLoading] = useState(false); // true while the access list or search fetch is in flight
    const [isFindNewUserLoading, setIsFindNewUserLoading] = useState(false); // true while the find-new fetch is in flight

    /** Fetches the full paginated access list for the document. */
    const fetchAccessList = async (docId: string) => {
        try {
            setIsExistingUsersLoading(true);
            const { data } = await apiClient.get<GetDocumentAccessResponseDto>(
                `/document/${docId}/access`,
                { params: { limit: ACCESS_LIST_LIMIT } },
            );
            setExistingUsers(data.users);
        } catch (err) {
            console.error("ManageAccessTab: failed to fetch access list:", err);
        } finally {
            setIsExistingUsersLoading(false);
        }
    };

    /** Searches existing access users by email using fuzzy matching. */
    const fetchSearchResults = async (docId: string, query: string) => {
        try {
            setIsExistingUsersLoading(true);
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
            setIsExistingUsersLoading(false);
        }
    };

    /** Looks up a user by exact email who does not yet have access. */
    const fetchFindNew = async (docId: string, query: string) => {
        try {
            setIsFindNewUserLoading(true);
            const { data } =
                await apiClient.get<FindNewDocumentAccessUserResponseDto>(
                    `/document/${docId}/access/find-new`,
                    { params: { email: query } },
                );
            setFoundUser(data);
        } catch {
            setFoundUser(null);
        } finally {
            setIsFindNewUserLoading(false);
        }
    };

    // Switches between full list and email-driven fetches depending on email state.
    // When email is empty, resets find state and fetches the full access list.
    // When non-empty, debounces 300 ms then fires find-new and search independently.
    useEffect(() => {
        if (!documentId) return;

        if (email.trim() === "") {
            setFoundUser(null);
            fetchAccessList(documentId);
            return;
        }

        const timeout = setTimeout(() => {
            if (isValidEmail(email.trim()))
                fetchFindNew(documentId, email.trim());
            fetchSearchResults(documentId, email.trim());
        }, 300);

        return () => clearTimeout(timeout);
    }, [documentId, email]);

    return {
        existingUsers,
        foundUser,
        setFoundUser,
        isExistingUsersLoading,
        isFindNewUserLoading,
        fetchAccessList,
        fetchSearchResults,
    };
};

export default useManageAccessTab;
