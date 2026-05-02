import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../lib/http";

/**
 * Manages document deletion state. Sends the delete request on confirm,
 * navigates to /library on success, and closes the dialog on Escape.
 */
const useDeleteDocument = ({
    documentId,
    onCancel,
}: {
    /** ID of the document to delete. */
    documentId: string | undefined;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
}) => {
    const [isDeleting, setIsDeleting] = useState(false); // true while the delete request is in flight
    const navigate = useNavigate(); // used to redirect to /library after successful deletion

    // Close on Escape key, treating it as a cancel.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    /** Sends the delete request and navigates to /library on success. */
    const handleConfirm = async () => {
        if (!documentId) return;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/document/${documentId}`);
            navigate("/library");
        } catch (err) {
            console.error(
                "DeleteConfirmationModal: failed to delete document:",
                err,
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return { isDeleting, handleConfirm };
};

export default useDeleteDocument;
