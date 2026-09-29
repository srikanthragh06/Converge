import { useState } from "react";
import type { ApiKeyDto } from "@converge/shared";
import apiClient from "../lib/http";
import useToast from "./useToast";

/**
 * Revokes an API key via DELETE /api-keys/:id, then calls onSuccess so the
 * caller can close its dialog and refresh the list. Success and failure are
 * both reported with a toast.
 * @param apiKey - the key to revoke
 * @param onSuccess - called after a successful revoke
 */
const useRevokeApiKey = ({
    apiKey,
    onSuccess,
}: {
    apiKey: ApiKeyDto;
    onSuccess: () => void;
}) => {
    const { showToast } = useToast();
    const [isRevoking, setIsRevoking] = useState(false); // true while the revoke request is in flight

    /** Sends the revoke request. */
    const handleConfirm = async () => {
        setIsRevoking(true);
        try {
            await apiClient.delete(`/api-keys/${apiKey.id}`);
            showToast(`Revoked "${apiKey.label}"`);
            onSuccess();
        } catch (err) {
            console.error("useRevokeApiKey: failed to revoke API key:", err);
            showToast("Couldn't revoke the key", { tone: "error" });
        } finally {
            setIsRevoking(false);
        }
    };

    return { isRevoking, handleConfirm };
};

export default useRevokeApiKey;
