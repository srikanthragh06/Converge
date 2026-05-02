import type { GetDocumentOverviewResponseDto } from "@converge/shared";
import { useEffect, useState } from "react";
import apiClient from "../lib/http";

/**
 * Manages Overview tab state: fetches document overview data on mount and
 * controls the delete confirmation modal. Also closes the parent modal on
 * Escape unless the delete confirmation is open.
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

    // Fetch overview data on mount.
    useEffect(() => {
        if (!documentId) return;
        apiClient
            .get<GetDocumentOverviewResponseDto>(
                `/document/${documentId}/overview`,
            )
            .then((res) => setOverview(res.data))
            .catch((err) =>
                console.error(
                    "ManageDocumentModal: failed to fetch overview:",
                    err,
                ),
            );
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
        isDeleteDocumentConfirmOpen,
        setIsDeleteDocumentConfirmOpen,
    };
};

export default useOverviewTab;
