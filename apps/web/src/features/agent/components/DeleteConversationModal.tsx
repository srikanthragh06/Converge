import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import Button from "@/components/ui/Button";

/**
 * Confirmation before a conversation is hard-deleted (conversations have no
 * trash or restore, unlike documents). Escape, the backdrop, and Cancel all
 * call onCancel, except while the delete is in flight.
 * @param onConfirm - deletes the conversation; the caller closes the modal once it succeeds
 * @param onCancel - closes the modal without deleting
 * @param isDeleting - the delete is in flight, so the buttons are disabled
 */
const DeleteConversationModal = ({
    onConfirm,
    onCancel,
    isDeleting,
}: {
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}) => {
    return (
        <Modal onClose={onCancel} title="Delete chat" dismissible={!isDeleting}>
            <p className="text-sm text-fg-secondary">
                Delete this conversation? This can't be undone.
            </p>
            <ModalFooter>
                <Button onClick={onCancel} disabled={isDeleting}>
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    onClick={onConfirm}
                    disabled={isDeleting}
                >
                    {isDeleting ? "Deleting…" : "Delete"}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default DeleteConversationModal;
