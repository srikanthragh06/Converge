import useRevokeApiKey from "../../../hooks/useRevokeApiKey";

/**
 * Confirmation dialog shown before an API key is revoked. Handles the
 * revoke API call and calls onSuccess to let the page refresh its list.
 * Closes on Escape or backdrop click, both of which call onCancel.
 */
const RevokeApiKeyConfirmationModal = ({
    keyId,
    label,
    onCancel,
    onSuccess,
}: {
    /** ID of the API key to revoke. */
    keyId: number;
    /** Label of the key, shown in the confirmation copy. */
    label: string;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
    /** Called after a successful revoke. */
    onSuccess: () => void;
}) => {
    const { isRevoking, handleConfirm } = useRevokeApiKey({
        keyId,
        onCancel,
        onSuccess,
    });

    return (
        // Backdrop — click outside to cancel
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
                    Revoke <span className="text-white font-medium">{label}</span>?
                    Anything using this key will stop working immediately.
                    This cannot be undone.
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isRevoking}
                        className="px-3 py-1.5 text-sm rounded-md bg-transparent
                            text-text-secondary cursor-pointer hover:opacity-80
                            active:opacity-70 transition disabled:opacity-40
                            disabled:cursor-not-allowed border-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isRevoking}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-700 text-white
                            border-none cursor-pointer hover:opacity-80 active:opacity-70
                            transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isRevoking ? "Revoking..." : "Revoke"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RevokeApiKeyConfirmationModal;
