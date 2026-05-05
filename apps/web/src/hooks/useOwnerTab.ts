import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    GetDocumentOwnerResponseDto,
    FindNewDocumentOwnerResponseDto,
    TransferDocumentOwnerResponseDto,
} from "@converge/shared";
import { isValidEmail } from "../utils/utils";

/**
 * Manages OwnerTab state. Fetches the document's current owner on mount.
 * When email is non-empty (debounced 300 ms), calls the owner find endpoint
 * to resolve a candidate for ownership transfer.
 */
const useOwnerTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const [owner, setOwner] = useState<GetDocumentOwnerResponseDto | null>(
        null,
    ); // current document owner; null while loading or on error
    const [isOwnerLoading, setIsOwnerLoading] = useState(false); // true while the GET /owner fetch is in flight
    const [email, setEmail] = useState(""); // current email search query for ownership transfer
    const [foundUser, setFoundUser] =
        useState<FindNewDocumentOwnerResponseDto | null>(null); // user resolved by exact email who can receive ownership
    const [isFindLoading, setIsFindLoading] = useState(false); // true while the owner find fetch is in flight
    const [isFindConflict, setIsFindConflict] = useState(false); // true when find returns 409 (user is already the owner)
    const [isTransferConfirmOpen, setIsTransferConfirmOpen] = useState(false); // true while the transfer confirmation modal is open
    const [isTransferring, setIsTransferring] = useState(false); // true while the PUT /owner request is in flight

    // Fetches the document's current owner on mount.
    useEffect(() => {
        if (!documentId) return;

        const fetch = async () => {
            try {
                setIsOwnerLoading(true);
                const { data } =
                    await apiClient.get<GetDocumentOwnerResponseDto>(
                        `/document/${documentId}/owner`,
                    );
                setOwner(data);
            } catch (err) {
                console.error("useOwnerTab: failed to fetch owner:", err);
            } finally {
                setIsOwnerLoading(false);
            }
        };

        fetch();
    }, [documentId]);

    /** Looks up a user by exact email who can receive ownership. */
    const fetchFindNewOwner = async (docId: string, query: string) => {
        try {
            setIsFindLoading(true);
            setIsFindConflict(false);
            const { data } =
                await apiClient.get<FindNewDocumentOwnerResponseDto>(
                    `/document/${docId}/owner/find`,
                    { params: { email: query } },
                );
            setFoundUser(data);
        } catch (err: any) {
            setFoundUser(null);
            // 409 means the looked-up user is already the document owner.
            setIsFindConflict(err?.response?.status === 409);
        } finally {
            setIsFindLoading(false);
        }
    };

    /**
     * Calls PUT /document/:id/owner to transfer ownership to foundUser. On
     * success, updates the displayed owner and clears the search state.
     */
    const transferOwner = async () => {
        if (!documentId || !foundUser) return;

        try {
            setIsTransferring(true);
            const { data } =
                await apiClient.put<TransferDocumentOwnerResponseDto>(
                    `/document/${documentId}/owner`,
                    { newOwnerId: foundUser.id },
                );
            // Update the displayed owner and clear the search so the tab reflects the new state.
            setOwner(data);
            setFoundUser(null);
            setEmail("");
            setIsTransferConfirmOpen(false);
        } catch (err) {
            console.error("useOwnerTab: failed to transfer ownership:", err);
        } finally {
            setIsTransferring(false);
        }
    };

    // Resets find state when email is cleared; debounces 300 ms then fires the
    // owner find endpoint when a valid email is entered.
    useEffect(() => {
        if (!documentId) return;

        if (email.trim() === "") {
            setFoundUser(null);
            setIsFindConflict(false);
            return;
        }

        const timeout = setTimeout(() => {
            setIsFindConflict(false);
            if (isValidEmail(email.trim()))
                fetchFindNewOwner(documentId, email.trim());
        }, 300);

        return () => clearTimeout(timeout);
    }, [documentId, email]);

    return {
        owner,
        isOwnerLoading,
        email,
        setEmail,
        foundUser,
        isFindLoading,
        isFindConflict,
        isTransferConfirmOpen,
        setIsTransferConfirmOpen,
        isTransferring,
        transferOwner,
    };
};

export default useOwnerTab;
