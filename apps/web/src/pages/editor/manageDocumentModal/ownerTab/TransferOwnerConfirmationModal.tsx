import { useEffect } from "react";

/**
 * Confirmation dialog shown before ownership is transferred. Closes on
 * Escape or backdrop click, both of which call onCancel. Sits above
 * ManageDocumentModal via z-[60].
 */
const TransferOwnerConfirmationModal = ({
    newOwnerName,
    onCancel,
    onConfirm,
    isTransferring,
}: {
    /** Display name of the incoming owner, shown in the confirmation message. */
    newOwnerName: string;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
    /** Called when the user confirms the transfer. */
    onConfirm: () => void;
    /** When true, disables both buttons and shows a loading label on the confirm button. */
    isTransferring: boolean;
}) => {
    // Close on Escape key, treating it as a cancel.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    return (
        // Backdrop — click outside to cancel; z-[60] sits above ManageDocumentModal's z-50
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
                    Transfer ownership to{" "}
                    <span className="text-white">{newOwnerName}</span>? You will
                    become an admin.
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isTransferring}
                        className="px-3 py-1.5 text-sm rounded-md bg-transparent
                            text-text-secondary cursor-pointer hover:opacity-80
                            active:opacity-70 transition disabled:opacity-40
                            disabled:cursor-not-allowed border-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isTransferring}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-700 text-white
                            border-none cursor-pointer hover:opacity-80 active:opacity-70
                            transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isTransferring ? "Transferring..." : "Transfer"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransferOwnerConfirmationModal;
