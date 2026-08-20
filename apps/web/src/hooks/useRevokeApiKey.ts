import { useEffect, useState } from "react";
import apiClient from "../lib/http";

/**
 * Manages API key revocation state. Sends the revoke request on confirm,
 * calls onSuccess to let the caller refresh its list and close the dialog,
 * and closes the dialog on Escape via onCancel.
 */
const useRevokeApiKey = ({
    keyId,
    onCancel,
    onSuccess,
}: {
    /** ID of the API key to revoke. */
    keyId: number;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
    /** Called after a successful revoke. */
    onSuccess: () => void;
}) => {
    const [isRevoking, setIsRevoking] = useState(false); // true while the revoke request is in flight

    // Close on Escape key, treating it as a cancel.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    /** Sends the revoke request and calls onSuccess on success. */
    const handleConfirm = async () => {
        setIsRevoking(true);
        try {
            await apiClient.delete(`/api-keys/${keyId}`);
            onSuccess();
        } catch (err) {
            console.error(
                "RevokeApiKeyConfirmationModal: failed to revoke API key:",
                err,
            );
        } finally {
            setIsRevoking(false);
        }
    };

    return { isRevoking, handleConfirm };
};

export default useRevokeApiKey;
