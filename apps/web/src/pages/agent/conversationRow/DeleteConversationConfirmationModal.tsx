import { useState } from "react";

/**
 * Confirmation dialog shown before a conversation is hard-deleted (no
 * trash/restore for conversations, unlike documents). Same
 * backdrop/panel/button shape as DeleteDocumentConfirmationModal. Closes on
 * Escape or backdrop click, both of which call onCancel.
 */
const DeleteConversationConfirmationModal = ({
    onConfirm,
    onCancel,
}: {
    /** Called to actually delete the conversation. */
    onConfirm: () => Promise<void>;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
}) => {
    const [isDeleting, setIsDeleting] = useState(false); // true while the delete request is in flight, to disable both buttons and avoid a double-submit

    /** Runs the delete, keeping the dialog open (and buttons disabled) until it settles. */
    const handleConfirm = async () => {
        setIsDeleting(true);
        await onConfirm();
    };

    return (
        // Backdrop — click outside to cancel; z-60 matches the document delete modal's stacking context
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
                    Delete this conversation? This can't be undone.
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
                        onClick={() => void handleConfirm()}
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

export default DeleteConversationConfirmationModal;
