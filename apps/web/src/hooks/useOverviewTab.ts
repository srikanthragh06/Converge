import type {
    GetDocumentOverviewResponseDto,
    GetDocumentResponseDto,
    ResolvedDocumentAccessLevel,
} from "@converge/shared";
import { useEffect, useState } from "react";
import apiClient from "../lib/http";

/**
 * Manages Overview tab state: fetches document overview data and the current
 * user's resolved access level on mount, and controls the delete confirmation
 * modal. Also closes the parent modal on Escape unless the delete confirmation
 * is open.
 */
const useOverviewTab = ({
    onClose,
    documentId,
}: {
    /** Called when the user dismisses the modal. */
    onClose: () => void;
    /** ID of the document being managed, passed to DeleteConfirmationModal. */
    documentId: string | undefined;
}) => {
    const [isDeleteDocumentConfirmOpen, setIsDeleteDocumentConfirmOpen] =
        useState(false); // controls DeleteConfirmationModal visibility
    const [overview, setOverview] =
        useState<GetDocumentOverviewResponseDto | null>(null); // fetched overview data; null while loading or on error
    const [documentAccess, setDocumentAccess] =
        useState<ResolvedDocumentAccessLevel | null>(null); // resolved access level for the current user; null while loading or on error
    const [isOverviewLoading, setIsOverviewLoading] = useState(true); // true until the overview fetch settles
    const [isAccessLoading, setIsAccessLoading] = useState(true); // true until the access fetch settles
    const isLoading = isOverviewLoading || isAccessLoading; // true while either request is in-flight

    // Fetch overview data and the current user's resolved access level in parallel on mount.
    useEffect(() => {
        if (!documentId) {
            setIsOverviewLoading(false);
            setIsAccessLoading(false);
            return;
        }

        /** Fetches document metadata (title, creator, owner, created date) for the overview panel. */
        const fetchOverview = async () => {
            try {
                const res = await apiClient.get<GetDocumentOverviewResponseDto>(
                    `/document/${documentId}/overview`,
                );
                setOverview(res.data);
            } catch (err) {
                console.error(
                    "ManageDocumentModal: failed to fetch overview:",
                    err,
                );
            } finally {
                setIsOverviewLoading(false);
            }
        };

        /** Fetches the current user's resolved access level so the Delete button can be gated correctly. */
        const fetchDocumentAccess = async () => {
            try {
                const res = await apiClient.get<GetDocumentResponseDto>(
                    `/document/id/${documentId}`,
                );
                setDocumentAccess(res.data.resolvedAccess);
            } catch (err) {
                console.error(
                    "ManageDocumentModal: failed to fetch document access:",
                    err,
                );
            } finally {
                setIsAccessLoading(false);
            }
        };

        fetchOverview();
        fetchDocumentAccess();
    }, [documentId]);

    // Close on Escape key, but only when the confirmation modal is not open
    // (DeleteConfirmationModal has its own Escape handler and takes priority).
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isDeleteDocumentConfirmOpen) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, isDeleteDocumentConfirmOpen]);

    return {
        overview,
        documentAccess,
        isLoading,
        isDeleteDocumentConfirmOpen,
        setIsDeleteDocumentConfirmOpen,
    };
};

export default useOverviewTab;
