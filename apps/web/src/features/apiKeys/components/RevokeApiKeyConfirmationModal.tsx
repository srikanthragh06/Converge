import { LuKeyRound } from "react-icons/lu";
import type { ApiKeyDto } from "@converge/shared";
import { timeAgo } from "@/lib/utils";
import useRevokeApiKey from "@/features/apiKeys/hooks/useRevokeApiKey";
import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import Button from "@/components/ui/Button";

/**
 * Confirmation before an API key is revoked (pp 36 / 44): the key's name,
 * prefix, and last use, with Cancel and a red Revoke key.
 * @param apiKey - the key to revoke
 * @param onCancel - closes the dialog
 * @param onSuccess - called after a successful revoke
 */
const RevokeApiKeyConfirmationModal = ({
    apiKey,
    onCancel,
    onSuccess,
}: {
    apiKey: ApiKeyDto;
    onCancel: () => void;
    onSuccess: () => void;
}) => {
    const { isRevoking, handleConfirm } = useRevokeApiKey({
        apiKey,
        onSuccess,
    });

    return (
        <Modal
            onClose={onCancel}
            title="Revoke this key?"
            description="Any agent using it stops working immediately. This can't be undone."
            dismissible={!isRevoking}
            size="md"
            className="sm:max-w-[32rem]"
        >
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-surface-inset px-4 py-3">
                <LuKeyRound className="h-4 w-4 shrink-0 text-fg-muted" />
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-fg">
                        {apiKey.label}
                    </span>
                    <span className="truncate font-mono text-xs text-fg-muted">
                        {apiKey.keyPrefix}… ·{" "}
                        {apiKey.lastUsedAt
                            ? `last used ${timeAgo(apiKey.lastUsedAt)}`
                            : "never used"}
                    </span>
                </div>
            </div>
            <ModalFooter>
                <Button onClick={onCancel} disabled={isRevoking}>
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    onClick={handleConfirm}
                    disabled={isRevoking}
                >
                    {isRevoking ? "Revoking…" : "Revoke key"}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default RevokeApiKeyConfirmationModal;
