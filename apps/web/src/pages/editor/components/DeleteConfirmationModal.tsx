import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../../lib/http";

/**
 * Confirmation dialog shown before a document is soft-deleted. Handles the
 * delete API call and navigates to /library on success. Closes on Escape or
 * backdrop click, both of which call onCancel.
 */
const DeleteConfirmationModal = ({
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
            console.error("DeleteConfirmationModal: failed to delete document:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        // Backdrop — click outside to cancel; z-60 sits above ManageDocumentModal's z-50
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
            onClick={onCancel}
        >
            {/* Dialog panel */}
            <div
                className="bg-background-elevated rounded-xl px-6 py-5 w-full max-w-sm mx-4 flex flex-col gap-5"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-text-secondary text-sm">
                    Are you sure you want to delete this document?
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-sm rounded-md bg-transparent
                            text-text-secondary cursor-pointer hover:opacity-80
                            active:opacity-70 transition disabled:opacity-40
                            disabled:cursor-not-allowed border-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-700 text-white
                            border-none cursor-pointer hover:opacity-80 active:opacity-70
                            transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
